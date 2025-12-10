import type { Stagehand } from "@browserbasehq/stagehand";
import type { GrammarlyCredentials } from "../../auth/onePasswordProvider";
import { log } from "../../config";
import { sleep } from "../../utils";
import { checkGrammarlyAuthStatus } from "./grammarlyTask";

const DEFAULT_MAX_RETRIES = 1;

/**
 * Result of an auto-login attempt.
 */
export interface LoginAttemptResult {
  success: boolean;
  /** Error message if login failed */
  error?: string;
  /** True if login failed due to wrong credentials */
  invalidCredentials?: boolean;
  /** True if CAPTCHA blocked the login */
  captchaDetected?: boolean;
  /** True if rate limit was triggered */
  rateLimited?: boolean;
}

/**
 * Options for auto-login attempt.
 */
export interface AutoLoginOptions {
  /** Maximum time to wait for login completion (ms) */
  timeoutMs?: number;
  /** Number of retry attempts for transient failures */
  maxRetries?: number;
}

/**
 * Detect common login failure scenarios by observing error messages.
 */
async function detectLoginFailure(
  stagehand: Stagehand,
): Promise<Partial<LoginAttemptResult>> {
  const page = stagehand.context.pages()[0];
  if (!page) {
    return {};
  }

  try {
    // Look for error indicators in the UI
    const errorIndicators = await stagehand.observe(
      "Find any error messages about invalid credentials, wrong password, " +
        "account locked, CAPTCHA challenges, rate limits, or 'too many attempts' warnings",
    );

    if (errorIndicators.length === 0) {
      return {}; // No error indicators found
    }

    // Analyze error type based on observation descriptions
    const errorText = errorIndicators
      .map((e) => e.description?.toLowerCase() ?? "")
      .join(" ");

    if (
      errorText.includes("captcha") ||
      errorText.includes("verify") ||
      errorText.includes("robot") ||
      errorText.includes("not a robot")
    ) {
      return { captchaDetected: true, error: "CAPTCHA challenge detected" };
    }

    if (
      errorText.includes("too many") ||
      errorText.includes("rate") ||
      errorText.includes("try again later") ||
      errorText.includes("temporarily blocked")
    ) {
      return { rateLimited: true, error: "Rate limit triggered" };
    }

    if (
      errorText.includes("invalid") ||
      errorText.includes("incorrect") ||
      errorText.includes("wrong") ||
      errorText.includes("not found") ||
      errorText.includes("doesn't match")
    ) {
      return {
        invalidCredentials: true,
        error: "Invalid credentials",
      };
    }

    return { error: "Login error detected" };
  } catch {
    return {}; // Observation failed, no error detected
  }
}

/**
 * Attempt to log into Grammarly using provided credentials.
 * Uses Stagehand's observe()->act() pattern for reliable automation.
 *
 * Flow:
 * 1. Navigate to Grammarly login page if not already there
 * 2. Observe email input field
 * 3. Act to fill email and submit
 * 4. Observe password input field (may be separate page)
 * 5. Act to fill password and submit
 * 6. Verify successful login via auth status check
 *
 * @param stagehand - Active Stagehand instance
 * @param credentials - Username/password from 1Password
 * @param options - Optional timeout and retry settings
 * @returns LoginAttemptResult indicating success or failure reason
 */
export async function attemptGrammarlyLogin(
  stagehand: Stagehand,
  credentials: GrammarlyCredentials,
  options?: AutoLoginOptions,
): Promise<LoginAttemptResult> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;

  log("info", "Attempting automatic Grammarly login via 1Password credentials");

  const page = stagehand.context.pages()[0];
  if (!page) {
    return { success: false, error: "No page available in Stagehand context" };
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Step 1: Navigate to Grammarly login if not already there
      const currentUrl = page.url();
      if (
        !currentUrl.includes("grammarly.com/signin") &&
        !currentUrl.includes("grammarly.com/login")
      ) {
        log("debug", "Navigating to Grammarly login page");
        await page.goto("https://www.grammarly.com/signin", {
          waitUntil: "load",
        });
        await sleep(2000); // Allow page to fully load and login form to be ready
      }

      // Step 2: Look for "Log in with email" button first (common on Grammarly)
      log("debug", "Looking for email login option");
      const emailLoginButton = await stagehand.observe(
        "Find the 'Log in with email' button or 'Continue with email' option",
      );
      const firstEmailButton = emailLoginButton[0];
      if (firstEmailButton) {
        await stagehand.act(firstEmailButton);
        await sleep(1500);
      }

      // Step 3: Observe and fill email field
      log("debug", "Looking for email input field");
      await stagehand.observe(
        "Find the email or username input field for logging into Grammarly",
      );

      // Fill email using locator for security (avoids exposing PII to LLM)
      // Try common email input selectors
      const emailInputs = [
        'input[type="email"]',
        'input[type="text"]',
        'input[name*="email"]',
        'input[name*="username"]',
      ];

      let emailFilled = false;
      for (const selector of emailInputs) {
        try {
          const locator = page.locator(selector).first();
          if (await locator.isVisible()) {
            await locator.fill(credentials.username);
            emailFilled = true;
            break;
          }
        } catch {
          // Try next selector
        }
      }

      // Fallback to stagehand.act if locator approach fails
      if (!emailFilled) {
        await stagehand.act(
          "Click on the email input field and type the email",
        );
      }
      await sleep(500);

      // Step 4: Submit email (may navigate to password page)
      await stagehand.act(
        "Click the 'Continue' or 'Next' button to proceed after entering email",
      );
      await sleep(2000);

      // Step 5: Observe and fill password field
      log("debug", "Looking for password input field");
      const passwordObservation = await stagehand.observe(
        "Find the password input field",
      );

      if (passwordObservation.length === 0) {
        // Check for errors before failing
        const failure = await detectLoginFailure(stagehand);
        if (failure.error) {
          return { success: false, ...failure };
        }
        return { success: false, error: "Password field not found" };
      }

      // SECURITY: Fill password using Playwright's locator.fill()
      // This avoids passing the password through the LLM via stagehand.act()
      log("debug", "Filling password field securely");
      const passwordInput = page.locator('input[type="password"]');
      await passwordInput.fill(credentials.password);
      await sleep(500);

      // Step 6: Submit login
      await stagehand.act(
        "Click the 'Log in', 'Sign in', or submit button to complete login",
      );
      await sleep(3000);

      // Step 7: Verify login success
      const authStatus = await checkGrammarlyAuthStatus(stagehand);

      if (authStatus.loggedIn) {
        log("info", "Automatic Grammarly login successful");
        return { success: true };
      }

      // Check for specific failure reasons
      const failure = await detectLoginFailure(stagehand);
      if (
        failure.invalidCredentials ||
        failure.captchaDetected ||
        failure.rateLimited
      ) {
        // Don't retry these failures - they require user intervention
        return { success: false, ...failure };
      }

      if (attempt < maxRetries) {
        log("debug", `Login attempt ${attempt + 1} failed, retrying...`);
        const baseDelayMs = 2000;
        const maxDelayMs = 30000;
        const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
        log("debug", `Waiting ${delay}ms before retry attempt ${attempt + 2}`);
        await sleep(delay);
      }
    } catch (error) {
      log("warn", `Auto-login attempt ${attempt + 1} failed`, {
        error: error instanceof Error ? error.message : String(error),
      });

      if (attempt >= maxRetries) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }

      const baseDelayMs = 2000;
      const maxDelayMs = 30000;
      const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      log("debug", `Waiting ${delay}ms before retry attempt ${attempt + 2}`);
      await sleep(delay);
    }
  }

  return { success: false, error: "Login failed after all retry attempts" };
}
