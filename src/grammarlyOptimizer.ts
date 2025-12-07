import { z } from "zod";
import {
  createBrowserUseClient,
  createGrammarlySession,
  type GrammarlyScores,
  runGrammarlyScoreTask,
} from "./browser/grammarlyTask.js";
import type { AppConfig } from "./config.js";
import { log } from "./config.js";
import {
  analyzeTextWithClaude,
  RewriterToneSchema,
  rewriteTextWithClaude,
  summarizeOptimizationWithClaude,
} from "./llm/claudeClient.js";

export const ToolInputSchema = z.object({
  text: z.string().min(1, "text is required"),
  mode: z
    .enum(["score_only", "optimize", "analyze"])
    .default("optimize")
    .describe("How to use Grammarly + Claude."),
  max_ai_percent: z
    .number()
    .min(0)
    .max(100)
    .default(10)
    .describe("Target maximum AI detection percentage."),
  max_plagiarism_percent: z
    .number()
    .min(0)
    .max(100)
    .default(5)
    .describe("Target maximum plagiarism percentage."),
  max_iterations: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(5)
    .describe("Maximum optimization iterations in optimize mode."),
  tone: RewriterToneSchema.default("neutral").describe(
    "Desired tone of the final text.",
  ),
  domain_hint: z
    .string()
    .max(200)
    .optional()
    .describe("Short description of the domain (e.g., 'university essay')."),
  custom_instructions: z
    .string()
    .max(2000)
    .optional()
    .describe(
      "Extra constraints (e.g., preserve citations, do not change code blocks).",
    ),
});

/** Zod schema for MCP 2025-11-25 structured output. */
export const ToolOutputSchema = z.object({
  final_text: z.string().describe("The optimized or original text."),
  ai_detection_percent: z
    .number()
    .nullable()
    .describe("Final AI detection percentage from Grammarly."),
  plagiarism_percent: z
    .number()
    .nullable()
    .describe("Final plagiarism percentage from Grammarly."),
  iterations_used: z
    .number()
    .int()
    .describe("Number of optimization iterations performed."),
  thresholds_met: z
    .boolean()
    .describe("Whether the AI and plagiarism thresholds were met."),
  history: z
    .array(
      z.object({
        iteration: z.number().int(),
        ai_detection_percent: z.number().nullable(),
        plagiarism_percent: z.number().nullable(),
        note: z.string(),
      }),
    )
    .describe("History of scores and notes for each iteration."),
  notes: z.string().describe("Summary or analysis notes from Claude."),
});

/** Callback for MCP progress notifications during optimization (0-100%). */
export type ProgressCallback = (
  message: string,
  progress?: number,
) => Promise<void>;

export type GrammarlyOptimizeMode = "score_only" | "optimize" | "analyze";

export type GrammarlyOptimizeInput = z.infer<typeof ToolInputSchema>;

export interface HistoryEntry {
  iteration: number;
  ai_detection_percent: number | null;
  plagiarism_percent: number | null;
  note: string;
}

export interface GrammarlyOptimizeResult {
  final_text: string;
  ai_detection_percent: number | null;
  plagiarism_percent: number | null;
  iterations_used: number;
  thresholds_met: boolean;
  history: HistoryEntry[];
  notes: string;
}

function thresholdsMet(
  scores: GrammarlyScores,
  maxAiPercent: number,
  maxPlagiarismPercent: number,
): boolean {
  const aiUnavailable = scores.aiDetectionPercent === null;
  const plagiarismUnavailable = scores.plagiarismPercent === null;

  if (aiUnavailable && plagiarismUnavailable) {
    log("warn", "Cannot verify thresholds: both Grammarly scores unavailable");
    return false;
  }

  const aiOk =
    scores.aiDetectionPercent === null
      ? true
      : scores.aiDetectionPercent <= maxAiPercent;
  const plagiarismOk =
    scores.plagiarismPercent === null
      ? true
      : scores.plagiarismPercent <= maxPlagiarismPercent;

  return aiOk && plagiarismOk;
}

/**
 * Orchestrates scoring, analysis, or iterative optimization via Browser Use
 * and Claude. Supports MCP 2025-11-25 progress notifications.
 */
export async function runGrammarlyOptimization(
  appConfig: AppConfig,
  input: GrammarlyOptimizeInput,
  onProgress?: ProgressCallback,
): Promise<GrammarlyOptimizeResult> {
  const {
    text,
    mode,
    max_ai_percent,
    max_plagiarism_percent,
    max_iterations,
    tone,
    domain_hint,
    custom_instructions,
  } = input;

  const maxAiPercent = max_ai_percent;
  const maxPlagiarismPercent = max_plagiarism_percent;
  const maxIterations = max_iterations;

  const history: HistoryEntry[] = [];

  let currentText = text;
  let lastScores: GrammarlyScores | null = null;
  let iterationsUsed = 0;
  let reachedThresholds = false;

  // Progress: Creating browser session
  await onProgress?.("Creating Browser Use session...", 5);

  const browserUseClient = createBrowserUseClient(appConfig);
  let sessionId: string | null = null;

  try {
    sessionId = await createGrammarlySession(browserUseClient, appConfig);

    // Progress: Initial scoring
    await onProgress?.("Running initial Grammarly scoring...", 10);
    log("info", "Running initial Grammarly scoring pass");

    // Baseline scoring (iteration 0 before optimization loop).
    lastScores = await runGrammarlyScoreTask(
      browserUseClient,
      sessionId,
      currentText,
      appConfig,
    );

    history.push({
      iteration: 0,
      ai_detection_percent: lastScores.aiDetectionPercent,
      plagiarism_percent: lastScores.plagiarismPercent,
      note: "Baseline Grammarly scores on original text (iteration 0).",
    });

    if (mode === "score_only") {
      await onProgress?.("Scoring complete", 100);

      reachedThresholds = thresholdsMet(
        lastScores,
        maxAiPercent,
        maxPlagiarismPercent,
      );

      const notes = reachedThresholds
        ? "Score-only run: original text already meets configured AI and plagiarism thresholds."
        : "Score-only run: thresholds not met or scores unavailable; no rewriting performed.";

      return {
        final_text: currentText,
        ai_detection_percent: lastScores.aiDetectionPercent,
        plagiarism_percent: lastScores.plagiarismPercent,
        iterations_used: 0,
        thresholds_met: reachedThresholds,
        history,
        notes,
      };
    }

    if (mode === "analyze") {
      await onProgress?.("Analyzing text with Claude...", 50);

      const analysis = await analyzeTextWithClaude(
        appConfig,
        currentText,
        lastScores.aiDetectionPercent,
        lastScores.plagiarismPercent,
        maxAiPercent,
        maxPlagiarismPercent,
        tone,
        domain_hint,
      );

      reachedThresholds = thresholdsMet(
        lastScores,
        maxAiPercent,
        maxPlagiarismPercent,
      );

      await onProgress?.("Analysis complete", 100);

      return {
        final_text: currentText,
        ai_detection_percent: lastScores.aiDetectionPercent,
        plagiarism_percent: lastScores.plagiarismPercent,
        iterations_used: 0,
        thresholds_met: reachedThresholds,
        history,
        notes: analysis,
      };
    }

    // Mode: optimize
    await onProgress?.("Starting optimization loop...", 15);
    log("info", "Starting optimization loop", {
      maxIterations,
      maxAiPercent,
      maxPlagiarismPercent,
    });

    for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
      iterationsUsed = iteration;

      // Progress is iteration-based (not wall clock): 15–85% reserved for loop.
      const iterationProgress = 15 + ((iteration - 1) / maxIterations) * 70;
      await onProgress?.(
        `Iteration ${iteration}/${maxIterations}: Rewriting with Claude...`,
        iterationProgress,
      );

      const rewriteResult = await rewriteTextWithClaude(appConfig, {
        originalText: currentText,
        lastAiPercent: lastScores.aiDetectionPercent,
        lastPlagiarismPercent: lastScores.plagiarismPercent,
        targetMaxAiPercent: maxAiPercent,
        targetMaxPlagiarismPercent: maxPlagiarismPercent,
        tone,
        domainHint: domain_hint,
        customInstructions: custom_instructions,
        maxIterations,
      });

      currentText = rewriteResult.rewrittenText;

      // Progress: Re-scoring for this iteration.
      const scoringProgress = 15 + (iteration / maxIterations) * 70;
      await onProgress?.(
        `Iteration ${iteration}/${maxIterations}: Re-scoring with Grammarly...`,
        scoringProgress,
      );

      // Re-score the new candidate in the same session.
      lastScores = await runGrammarlyScoreTask(
        browserUseClient,
        sessionId,
        currentText,
        appConfig,
      );

      reachedThresholds = thresholdsMet(
        lastScores,
        maxAiPercent,
        maxPlagiarismPercent,
      );

      history.push({
        iteration,
        ai_detection_percent: lastScores.aiDetectionPercent,
        plagiarism_percent: lastScores.plagiarismPercent,
        note: rewriteResult.reasoning,
      });

      log("info", "Optimization iteration completed", {
        iteration,
        aiDetectionPercent: lastScores.aiDetectionPercent,
        plagiarismPercent: lastScores.plagiarismPercent,
        thresholdsMet: reachedThresholds,
      });

      if (reachedThresholds) {
        break;
      }
    }

    // Progress: Generating summary
    await onProgress?.("Generating optimization summary...", 92);

    // Final summary via Claude (optional but useful).
    const notes = await summarizeOptimizationWithClaude(appConfig, {
      mode,
      iterationsUsed,
      thresholdsMet: reachedThresholds,
      history,
      finalText: currentText,
      maxAiPercent,
      maxPlagiarismPercent,
    });

    // Progress: Complete
    await onProgress?.("Optimization complete", 100);

    return {
      final_text: currentText,
      ai_detection_percent: lastScores.aiDetectionPercent,
      plagiarism_percent: lastScores.plagiarismPercent,
      iterations_used: iterationsUsed,
      thresholds_met: reachedThresholds,
      history,
      notes,
    };
  } finally {
    if (sessionId) {
      try {
        await browserUseClient.sessions.deleteSession({
          session_id: sessionId,
        });
        log("debug", "Browser Use session closed", { sessionId });
      } catch (error) {
        log("warn", "Failed to close Browser Use session", {
          sessionId,
          error,
        });
      }
    }
  }
}
