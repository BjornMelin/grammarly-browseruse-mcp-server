# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm build          # Compile TypeScript to dist/
pnpm start          # Run the MCP server (requires env vars)
pnpm type-check     # TypeScript type checking only
pnpm biome:check    # Lint + format check (no writes)
pnpm biome:fix      # Auto-fix lint + format issues
pnpm check-all      # Run type-check && biome:check
```

## Architecture

Single-tool MCP server that orchestrates text optimization through three integrations:

```
MCP Server (stdio transport)
    └── grammarly_optimize_text tool
            │
            ├── grammarlyOptimizer.ts  (orchestration + iteration loop)
            │       │
            │       ├── browser/grammarlyTask.ts  (Browser Use Cloud → Grammarly UI)
            │       │
            │       └── llm/claudeClient.ts  (Vercel AI SDK → Claude for rewrites)
            │
            └── config.ts  (env validation, logging, defaults)
```

**Execution flow for `optimize` mode:**
1. Create Browser Use session with synced Grammarly profile
2. Score original text (get AI detection + plagiarism %)
3. Loop up to `max_iterations`:
   - Claude rewrites text based on scores, tone, domain
   - Browser Use re-scores via Grammarly UI
   - Break early if thresholds met
4. Claude generates final summary

## Key Conventions

- **Logging**: All logs go to stderr via `log()` from config.ts. Stdout is reserved for MCP JSON-RPC.
- **Zod schemas**: Input/output validation at tool boundaries. Types inferred from schemas.
- **Browser automation**: Uses natural language prompts, not CSS selectors. Browser Use agent interprets instructions.
- **Model selection**: Claude Sonnet by default; Opus for long texts (>3000 chars) or many iterations (>3).
- **Null scores**: Grammarly features may return `null` if not available (no Premium). Handle gracefully.

## Environment Variables

Required:
- `BROWSER_USE_API_KEY` - API key from cloud.browser-use.com
- `BROWSER_USE_PROFILE_ID` - Synced profile with Grammarly login state

Optional:
- `LOG_LEVEL` - debug | info | warn | error (default: info)
