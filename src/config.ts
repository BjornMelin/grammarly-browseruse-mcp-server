import { z } from "zod";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface AppConfig {
  browserUseApiKey: string;
  browserUseProfileId: string;
  claudeApiKey: string;
  logLevel: LogLevel;
  browserUseDefaultTimeoutMs: number;
  defaultMaxAiPercent: number;
  defaultMaxPlagiarismPercent: number;
  defaultMaxIterations: number;
}

const EnvSchema = z.object({
  BROWSER_USE_API_KEY: z
    .string()
    .min(1, "BROWSER_USE_API_KEY is required for Browser Use Cloud"),
  BROWSER_USE_PROFILE_ID: z
    .string()
    .min(1, "BROWSER_USE_PROFILE_ID is required for Grammarly profile"),
  CLAUDE_API_KEY: z
    .string()
    .min(1, "CLAUDE_API_KEY is required for Claude Code"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // Log to stderr; MCP hosts expect stdout to be protocol-only.
  // Exiting early avoids a half-configured server.
  console.error(
    "[grammarly-mcp:error] Invalid environment configuration",
    JSON.stringify(parsed.error.format(), null, 2),
  );
  process.exit(1);
}

const env = parsed.data;

// Default thresholds; can be overridden per-tool call via args.
export const config: AppConfig = {
  browserUseApiKey: env.BROWSER_USE_API_KEY,
  browserUseProfileId: env.BROWSER_USE_PROFILE_ID,
  claudeApiKey: env.CLAUDE_API_KEY,
  logLevel: env.LOG_LEVEL,
  browserUseDefaultTimeoutMs: 5 * 60 * 1000,
  defaultMaxAiPercent: 10,
  defaultMaxPlagiarismPercent: 5,
  defaultMaxIterations: 5,
};

const LOG_LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];

/**
 * Minimal logger that always writes to stderr.
 *
 * MCP JSON-RPC frames must go to stdout only.
 */
export function log(level: LogLevel, message: string, extra?: unknown): void {
  const configuredIndex = LOG_LEVELS.indexOf(config.logLevel);
  const levelIndex = LOG_LEVELS.indexOf(level);

  if (levelIndex < configuredIndex) {
    return;
  }

  const prefix = `[grammarly-mcp:${level}]`;
  if (typeof extra !== "undefined") {
    console.error(prefix, message, extra);
  } else {
    console.error(prefix, message);
  }
}
