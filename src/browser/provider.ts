import type { AppConfig } from "../config";
import type { GrammarlyScores } from "./grammarlyTask";

/**
 * Options for creating a browser session.
 */
export interface SessionOptions {
  proxyCountryCode?: string | null;
}

/**
 * Result from creating a browser session.
 */
export interface SessionResult {
  sessionId: string;
  liveUrl: string | null;
  contextId?: string;
}

/**
 * Options for scoring text via Grammarly.
 */
export interface ScoreOptions {
  maxSteps?: number;
  iteration?: number;
  mode?: string;
  flashMode?: boolean;
}

/**
 * Extended Grammarly scores with session metadata.
 */
export interface GrammarlyScoreResult extends GrammarlyScores {
  liveUrl?: string | null;
}

/**
 * Abstract interface for browser automation providers.
 * Supports both Stagehand (Browserbase) and Browser Use Cloud.
 */
export interface BrowserProvider {
  readonly providerName: "stagehand" | "browser-use";

  /**
   * Create a new browser session for Grammarly automation.
   */
  createSession(options?: SessionOptions): Promise<SessionResult>;

  /**
   * Score text using Grammarly's AI detector and plagiarism checker.
   */
  scoreText(
    sessionId: string,
    text: string,
    options?: ScoreOptions,
  ): Promise<GrammarlyScoreResult>;

  /**
   * Close and cleanup a browser session.
   */
  closeSession(sessionId: string): Promise<void>;
}

/**
 * Create a browser provider based on the configured provider type.
 */
export async function createBrowserProvider(
  config: AppConfig,
): Promise<BrowserProvider> {
  if (config.browserProvider === "stagehand") {
    const { StagehandProvider } = await import("./stagehand/index");
    return new StagehandProvider(config);
  }

  const { BrowserUseProvider } = await import("./browserUseProvider");
  return new BrowserUseProvider(config);
}
