import { BrowserUseClient } from "browser-use-sdk";
import { z } from "zod";
import type { AppConfig } from "../config.js";
import { log } from "../config.js";

/**
 * Structured scores as extracted by Browser Use from Grammarly's UI.
 */
export const GrammarlyScoresSchema = z.object({
  aiDetectionPercent: z
    .number()
    .min(0)
    .max(100)
    .nullable()
    .describe(
      "Overall AI-generated percentage as shown by Grammarly's AI Detector."
    ),
  plagiarismPercent: z
    .number()
    .min(0)
    .max(100)
    .nullable()
    .describe(
      "Overall plagiarism / originality percentage from Grammarly's Plagiarism Checker."
    ),
  notes: z
    .string()
    .describe(
      "Free-text notes about what was seen in the UI, including any warnings."
    )
});

export type GrammarlyScores = z.infer<typeof GrammarlyScoresSchema>;

export interface GrammarlyScoreTaskResult extends GrammarlyScores {}

/**
 * Build the natural-language task for Browser Use.
 *
 * The agent is expected to:
 * - Open Grammarly docs.
 * - Create a new document.
 * - Paste the provided text.
 * - Use AI Detector + Plagiarism Checker.
 * - Extract overall AI and plagiarism percentages.
 */
function buildGrammarlyTaskPrompt(text: string): string {
  return [
    "You are controlling a real browser that is already logged into a Grammarly or Superhuman account.",
    "",
    "Goal:",
    "1. Open the Grammarly docs writing surface at https://app.grammarly.com (or the equivalent docs surface if already open).",
    "2. Create a new document (not a classic doc).",
    "3. Paste the provided text exactly into the main editor area.",
    "4. Use Grammarly's AI Detector and Plagiarism Checker agents in the right-hand panel,",
    "   or the 'Check for AI text & plagiarism' control, to obtain:",
    "   - The overall AI-generated percentage (likelihood text was written with AI).",
    "   - The overall plagiarism / originality percentage.",
    "5. Wait for all results to fully load before reading the numbers.",
    "6. Return the results strictly in the JSON schema you were given.",
    "",
    "Important instructions:",
    "- Do not rewrite or paraphrase the text in the document.",
    "- If the AI Detector or Plagiarism Checker is not available, or scores cannot be found,",
    "  set the corresponding JSON field to null and explain why in notes.",
    "- When percentages are shown as strings like 'Probably AI-written' or 'No plagiarism found',",
    "  infer an approximate numeric percentage only if a number is explicitly visible.",
    "",
    "User text to evaluate (paste exactly as shown between markers):",
    "<START_USER_TEXT>",
    text,
    "<END_USER_TEXT>"
  ].join("\n");
}

/**
 * Factory for a BrowserUseClient bound to our API key.
 */
export function createBrowserUseClient(appConfig: AppConfig): BrowserUseClient {
  return new BrowserUseClient({
    apiKey: appConfig.browserUseApiKey
  });
}

/**
 * Create an authenticated session using a synced Browser Use profile.
 *
 * The profile contains the Grammarly/Superhuman login state.
 */
export async function createGrammarlySession(
  client: BrowserUseClient,
  appConfig: AppConfig
): Promise<string> {
  log("debug", "Creating Browser Use session with synced profile");
  try {
    const session = await client.sessions.createSession({
      profileId: appConfig.browserUseProfileId
    });

    if (!session || typeof session.id !== "string") {
      throw new Error("Browser Use session did not return a valid id");
    }

    log("info", "Browser Use session created", { sessionId: session.id });
    return session.id;
  } catch (error: unknown) {
    if (error instanceof Error) {
      log("error", "Failed to create Browser Use session", {
        message: error.message
      });
      throw error;
    }

    log("error", "Failed to create Browser Use session (unknown error)", error);
    throw new Error("Failed to create Browser Use session");
  }
}

/**
 * Run a Browser Use task that drives Grammarly's docs UI to compute AI and
 * plagiarism scores for the given text.
 */
export async function runGrammarlyScoreTask(
  client: BrowserUseClient,
  sessionId: string,
  text: string
): Promise<GrammarlyScoreTaskResult> {
  const taskPrompt = buildGrammarlyTaskPrompt(text);

  log("info", "Starting Browser Use Grammarly scoring task");

  try {
    const task = await client.tasks.createTask({
      sessionId,
      llm: "browser-use-llm",
      task: taskPrompt,
      schema: GrammarlyScoresSchema
    });

    const result = await task.complete();

    if (!result || !result.parsed) {
      log("error", "Browser Use result missing parsed structured output", {
        resultSummary: result ? Object.keys(result) : "no-result"
      });
      throw new Error("Browser Use task did not return structured scores");
    }

    const scores = result.parsed as GrammarlyScoreTaskResult;

    log("info", "Received Grammarly scores from Browser Use", {
      aiDetectionPercent: scores.aiDetectionPercent,
      plagiarismPercent: scores.plagiarismPercent
    });

    return scores;
  } catch (error: unknown) {
    if (error instanceof Error) {
      log("error", "Browser Use Grammarly scoring task failed", {
        message: error.message
      });
      throw error;
    }

    log(
      "error",
      "Browser Use Grammarly scoring task failed with unknown error",
      error
    );
    throw new Error("Browser Use Grammarly scoring task failed");
  }
}
