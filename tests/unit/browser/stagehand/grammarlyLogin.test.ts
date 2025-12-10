import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub setTimeout to skip sleep delays
vi.stubGlobal(
  "setTimeout",
  vi.fn((cb: () => void) => {
    cb();
    return 0 as unknown as NodeJS.Timeout;
  }),
);

// Use vi.hoisted to create mock functions before they're used in vi.mock factory
const { mockCheckGrammarlyAuthStatus } = vi.hoisted(() => ({
  mockCheckGrammarlyAuthStatus: vi.fn(),
}));

// Mock config
vi.mock("../../../../src/config", () => ({
  log: vi.fn(),
}));

// Mock checkGrammarlyAuthStatus from grammarlyTask
vi.mock("../../../../src/browser/stagehand/grammarlyTask", () => ({
  checkGrammarlyAuthStatus: mockCheckGrammarlyAuthStatus,
}));

// Import after mocking
import { attemptGrammarlyLogin } from "../../../../src/browser/stagehand/grammarlyLogin";
import type { GrammarlyCredentials } from "../../../../src/auth/onePasswordProvider";

// Mock Stagehand types
const mockPageUrl = vi.fn();
const mockPageGoto = vi.fn();
const mockPageLocator = vi.fn();
const mockLocatorFill = vi.fn();
const mockLocatorIsVisible = vi.fn();
const mockStagehandObserve = vi.fn();
const mockStagehandAct = vi.fn();

function createMockPage(url = "https://other-site.com") {
  return {
    url: mockPageUrl.mockReturnValue(url),
    goto: mockPageGoto,
    locator: mockPageLocator.mockReturnValue({
      fill: mockLocatorFill,
      first: vi.fn().mockReturnValue({
        fill: mockLocatorFill,
        isVisible: mockLocatorIsVisible.mockResolvedValue(true),
      }),
    }),
  };
}

function createMockStagehand(pages = [createMockPage()]) {
  return {
    context: { pages: vi.fn().mockReturnValue(pages) },
    observe: mockStagehandObserve,
    act: mockStagehandAct,
  } as unknown as Parameters<typeof attemptGrammarlyLogin>[0];
}

const testCredentials: GrammarlyCredentials = {
  username: "test@example.com",
  password: "testPassword123",
};

describe("attemptGrammarlyLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPageGoto.mockResolvedValue(undefined);
    mockLocatorFill.mockResolvedValue(undefined);
    mockLocatorIsVisible.mockResolvedValue(true);
    mockStagehandAct.mockResolvedValue(undefined);
  });

  describe("successful login", () => {
    beforeEach(() => {
      // Setup successful login flow mocks
      mockStagehandObserve
        .mockResolvedValueOnce([]) // No email login button
        .mockResolvedValueOnce([{ description: "Email input" }]) // Email field found
        .mockResolvedValueOnce([{ description: "Password input" }]); // Password field found

      mockCheckGrammarlyAuthStatus.mockResolvedValueOnce({ loggedIn: true });
    });

    it("navigates to login page when not already there", async () => {
      const stagehand = createMockStagehand([createMockPage("https://other-site.com")]);

      const result = await attemptGrammarlyLogin(stagehand, testCredentials);

      expect(mockPageGoto).toHaveBeenCalledWith(
        "https://www.grammarly.com/signin",
        { waitUntil: "load" },
      );
      expect(result.success).toBe(true);
    });

    it("skips navigation when already on login page", async () => {
      const stagehand = createMockStagehand([
        createMockPage("https://www.grammarly.com/signin"),
      ]);

      await attemptGrammarlyLogin(stagehand, testCredentials);

      expect(mockPageGoto).not.toHaveBeenCalled();
    });

    it("fills email and password fields", async () => {
      const stagehand = createMockStagehand([createMockPage()]);

      await attemptGrammarlyLogin(stagehand, testCredentials);

      // Email is filled via locator for security (not exposed to LLM)
      expect(mockPageLocator).toHaveBeenCalledWith(
        expect.stringMatching(/email|text|username/),
      );
      expect(mockLocatorFill).toHaveBeenCalledWith("test@example.com");

      // Password is filled via locator for security
      expect(mockPageLocator).toHaveBeenCalledWith('input[type="password"]');
      expect(mockLocatorFill).toHaveBeenCalledWith("testPassword123");
    });

    it("returns success when auth check passes", async () => {
      const stagehand = createMockStagehand([createMockPage()]);

      const result = await attemptGrammarlyLogin(stagehand, testCredentials);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe("login failures", () => {
    it("returns error when no page available", async () => {
      const stagehand = createMockStagehand([]);

      const result = await attemptGrammarlyLogin(stagehand, testCredentials);

      expect(result.success).toBe(false);
      expect(result.error).toBe("No page available in Stagehand context");
    });

    it("returns invalidCredentials when wrong password", async () => {
      mockStagehandObserve
        .mockResolvedValueOnce([]) // No email login button
        .mockResolvedValueOnce([{ description: "Email input" }])
        .mockResolvedValueOnce([{ description: "Password input" }])
        .mockResolvedValueOnce([{ description: "Invalid password error message" }]); // Error indicator

      mockCheckGrammarlyAuthStatus.mockResolvedValueOnce({ loggedIn: false });

      const stagehand = createMockStagehand([createMockPage()]);

      const result = await attemptGrammarlyLogin(stagehand, testCredentials);

      expect(result.success).toBe(false);
      expect(result.invalidCredentials).toBe(true);
    });

    it("returns captchaDetected when CAPTCHA shown", async () => {
      mockStagehandObserve
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ description: "Email input" }])
        .mockResolvedValueOnce([{ description: "Password input" }])
        .mockResolvedValueOnce([{ description: "Please verify you are not a robot" }]);

      mockCheckGrammarlyAuthStatus.mockResolvedValueOnce({ loggedIn: false });

      const stagehand = createMockStagehand([createMockPage()]);

      const result = await attemptGrammarlyLogin(stagehand, testCredentials);

      expect(result.success).toBe(false);
      expect(result.captchaDetected).toBe(true);
    });

    it("returns rateLimited when too many attempts", async () => {
      mockStagehandObserve
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ description: "Email input" }])
        .mockResolvedValueOnce([{ description: "Password input" }])
        .mockResolvedValueOnce([
          { description: "Too many login attempts, try again later" },
        ]);

      mockCheckGrammarlyAuthStatus.mockResolvedValueOnce({ loggedIn: false });

      const stagehand = createMockStagehand([createMockPage()]);

      const result = await attemptGrammarlyLogin(stagehand, testCredentials);

      expect(result.success).toBe(false);
      expect(result.rateLimited).toBe(true);
    });

    it("returns error when password field not found", async () => {
      mockStagehandObserve
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ description: "Email input" }])
        .mockResolvedValueOnce([]); // No password field found

      const stagehand = createMockStagehand([createMockPage()]);

      const result = await attemptGrammarlyLogin(stagehand, testCredentials);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Password field not found");
    });

    it("retries on transient failures", async () => {
      // First attempt fails without specific error
      mockStagehandObserve
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ description: "Email input" }])
        .mockResolvedValueOnce([{ description: "Password input" }])
        .mockResolvedValueOnce([]); // No error indicators

      mockCheckGrammarlyAuthStatus
        .mockResolvedValueOnce({ loggedIn: false }) // First attempt fails
        .mockResolvedValueOnce({ loggedIn: true }); // Retry succeeds

      // Setup for retry
      mockStagehandObserve
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ description: "Email input" }])
        .mockResolvedValueOnce([{ description: "Password input" }]);

      const stagehand = createMockStagehand([createMockPage()]);

      const result = await attemptGrammarlyLogin(stagehand, testCredentials, {
        maxRetries: 1,
      });

      expect(result.success).toBe(true);
    });

    it("does not retry on credential errors", async () => {
      mockStagehandObserve
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ description: "Email input" }])
        .mockResolvedValueOnce([{ description: "Password input" }])
        .mockResolvedValueOnce([{ description: "Incorrect password" }]);

      mockCheckGrammarlyAuthStatus.mockResolvedValue({ loggedIn: false });

      const stagehand = createMockStagehand([createMockPage()]);

      const result = await attemptGrammarlyLogin(stagehand, testCredentials, {
        maxRetries: 2,
      });

      // Should return after first attempt without retry
      expect(result.success).toBe(false);
      expect(result.invalidCredentials).toBe(true);
      // Only one call to checkGrammarlyAuthStatus means no retry
      expect(mockCheckGrammarlyAuthStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe("security", () => {
    beforeEach(() => {
      mockStagehandObserve
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ description: "Email input" }])
        .mockResolvedValueOnce([{ description: "Password input" }]);

      mockCheckGrammarlyAuthStatus.mockResolvedValueOnce({ loggedIn: true });
    });

    it("uses locator.fill for password input", async () => {
      const stagehand = createMockStagehand([createMockPage()]);

      await attemptGrammarlyLogin(stagehand, testCredentials);

      // Password should be filled via page locator, not stagehand.act
      expect(mockPageLocator).toHaveBeenCalledWith('input[type="password"]');
      expect(mockLocatorFill).toHaveBeenCalledWith("testPassword123");
    });

    it("does not pass password to stagehand.act", async () => {
      const stagehand = createMockStagehand([createMockPage()]);

      await attemptGrammarlyLogin(stagehand, testCredentials);

      // Verify no act call contains the password
      const actCalls = mockStagehandAct.mock.calls;
      for (const call of actCalls) {
        expect(call[0]).not.toContain("testPassword123");
      }
    });
  });
});
