#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config, log } from "./config.js";
import {
  type GrammarlyOptimizeInput,
  type ProgressCallback,
  runGrammarlyOptimization,
  ToolInputSchema,
  ToolOutputSchema,
} from "./grammarlyOptimizer.js";

/**
 * Create and configure the MCP server.
 *
 * This server implements MCP specification 2025-11-25 with:
 * - registerTool() API (replaces deprecated tool())
 * - Tool annotations for client hints
 * - Output schema for structured responses
 * - Tasks support for async operations (experimental)
 * - Progress notifications during long operations
 */
async function main(): Promise<void> {
  const server = new McpServer(
    {
      name: "grammarly-browseruse-mcp-server",
      version: "0.1.0",
    },
    {
      capabilities: {
        logging: {},
      },
    },
  );

  server.registerTool(
    "grammarly_optimize_text",
    {
      title: "Grammarly Text Optimizer",
      description:
        "Use Grammarly docs via Browser Use Cloud to score AI detection and plagiarism, and optionally rewrite text with Claude to reduce detection. " +
        "Supports three modes: 'score_only' (just get scores), 'analyze' (get scores + analysis), 'optimize' (iteratively rewrite to meet thresholds).",
      inputSchema: ToolInputSchema,
      outputSchema: ToolOutputSchema,
      annotations: {
        readOnlyHint: false, // Tool can rewrite text
        destructiveHint: false, // Non-destructive (original preserved in input)
        idempotentHint: false, // Each run may produce different results
        openWorldHint: true, // Interacts with Grammarly and Claude APIs
      },
    },
    async (args, extra) => {
      const parsed = ToolInputSchema.parse(args) as GrammarlyOptimizeInput;

      log("info", "Received grammarly_optimize_text tool call", {
        mode: parsed.mode,
        max_ai_percent: parsed.max_ai_percent,
        max_plagiarism_percent: parsed.max_plagiarism_percent,
        max_iterations: parsed.max_iterations,
      });

      // Create progress callback for MCP progress notifications.
      // NOTE: `extra._meta?.progressToken` is currently the available hook in the SDK;
      // if a public progress token accessor is added, prefer that instead.
      const progressToken = extra._meta?.progressToken;
      const onProgress: ProgressCallback = async (message, progress) => {
        if (extra.sendNotification && progressToken) {
          try {
            await extra.sendNotification({
              method: "notifications/progress",
              params: {
                progressToken,
                progress: progress ?? 0,
                total: 100,
                message,
              },
            });
          } catch {
            // Progress notifications are optional; ignore failures
          }
        }
        log("debug", `Progress: ${message}`, { progress });
      };

      const result = await runGrammarlyOptimization(config, parsed, onProgress);
      const validatedOutput = ToolOutputSchema.parse(result);

      // Return both text content (for compatibility) and structured content (MCP 2025-11-25)
      const textSummary = JSON.stringify(validatedOutput, null, 2);

      return {
        content: [
          {
            type: "text",
            text: textSummary,
          },
        ],
        structuredContent: validatedOutput,
      };
    },
  );

  const transport = new StdioServerTransport();

  log("info", "Starting Grammarly Browser Use MCP server over stdio");

  await server.connect(transport);
}

// Top-level await is supported in Node 18+ ESM.
void main().catch((error: unknown) => {
  if (error instanceof Error) {
    log("error", "[grammarly-mcp:fatal]", {
      message: error.message,
      stack: error.stack,
    });
  } else {
    log("error", "[grammarly-mcp:fatal] Unknown error", { error });
  }
  process.exit(1);
});
