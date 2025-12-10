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

# Testing
pnpm test           # Run tests in watch mode
pnpm test:run       # Run tests once
pnpm test:coverage  # Run tests with coverage report
pnpm test:unit      # Run unit tests only
pnpm test:integration  # Run integration tests (forks pool)
pnpm test:ci        # CI mode with coverage + JSON reporter
```

## Testing

**Framework**: Vitest with V8 coverage provider.

**Coverage thresholds** (enforced in CI):

- Lines: 85%
- Functions: 85%
- Branches: 75%
- Statements: 85%

**Test structure**:

```text
tests/
├── setup.ts              # Global test setup
├── unit/                 # Fast, isolated unit tests
│   ├── config.test.ts
│   ├── server.test.ts
│   ├── schemas.test.ts
│   ├── grammarlyOptimizer.test.ts
│   ├── auth/
│   │   └── onePasswordProvider.test.ts
│   ├── browser/
│   │   ├── provider.test.ts
│   │   ├── browserUseProvider.test.ts
│   │   ├── grammarlyTask.test.ts
│   │   └── stagehand/
│   │       ├── sessionManager.test.ts
│   │       ├── stagehandProvider.test.ts
│   │       ├── grammarlyTask.test.ts
│   │       └── grammarlyLogin.test.ts
│   └── llm/
│       ├── rewriteClient.test.ts
│       └── stagehandLlm.test.ts
└── integration/          # Tests requiring more isolation
    └── stagehandProvider.test.ts
```

**Mock patterns**:

- Use `vi.mock()` for module mocks; import after mocking
- Use `vi.fn()` for function mocks with `mockResolvedValue`/`mockRejectedValue`
- Use `vi.useFakeTimers()` for retry/backoff tests
- Stub `setTimeout` globally to skip `sleep()` delays in Stagehand tests

**Key conventions**:

- All tests are synchronous by default; async only when awaiting promises
- Mock at module boundaries (SDK clients, external services)
- Use `test.each()` for parameterized edge cases
- Attach catch handlers before advancing fake timers to prevent unhandled rejections

## Architecture

Single-tool MCP server with dual browser automation providers:

```text
MCP Server (stdio transport)
    └── grammarly_optimize_text tool
        │
        ├── grammarlyOptimizer.ts  (orchestration + iteration loop)
        │    │
        │    └── browser/provider.ts  (provider abstraction)
        │        │
        │        ├── stagehand/  (PRIMARY - default)
        │        │   ├── index.ts         (StagehandProvider)
        │        │   ├── sessionManager.ts (Browserbase sessions/contexts)
        │        │   ├── grammarlyTask.ts  (observe->act->extract)
        │        │   └── schemas.ts        (Zod extraction schemas)
        │        │
        │        └── browserUseProvider.ts  (FALLBACK)
        │            └── grammarlyTask.ts (Browser Use Cloud)
        │
        ├── llm/
        │   ├── stagehandLlm.ts   (multi-provider LLM for Stagehand)
        │   └── rewriteClient.ts  (multi-provider LLM for text rewrites)
        │
        └── config.ts  (dual-provider env validation, logging)
```

## Provider Selection

Set via `BROWSER_PROVIDER` env var: `stagehand` (default) or `browser-use`.

**Stagehand (default):** Browserbase cloud browsers with deterministic
observe->act->extract pattern. Supports session persistence, self-healing,
action caching.

**Browser Use (fallback):** Browser Use Cloud with natural language tasks.
Simpler setup, less reliable for production.

## Execution Flow

**Stagehand path:**

1. Get or create Browserbase session with optional context (login persistence)
2. Initialize Stagehand instance connected to session
3. Navigate to app.grammarly.com
4. observe() to find UI elements (new doc button, AI detector)
5. act() to interact (click, type text)
6. extract() with Zod schema to get structured scores
7. Close session; context persists for future use

**Optimization loop (both providers):**

1. Create browser session
2. Score original text (iteration 0)
3. Loop up to max_iterations:
   - Claude rewrites text based on scores + tone + domain
   - Re-score via Grammarly UI
   - Break early if thresholds met
4. Claude generates final summary

## Key Conventions

- **Logging**: All logs to stderr via `log()` from config.ts. stdout reserved for MCP JSON-RPC.
- **Zod schemas**: Input/output validation at tool boundaries; extraction schemas for Stagehand.
- **Provider abstraction**: BrowserProvider interface in provider.ts. Implementations must provide createSession(), scoreText(), closeSession().
- **Stagehand pattern**: observe() for element discovery, act() for interaction, extract() for structured data.
- **Session persistence**: Browserbase contexts store login state. Set BROWSERBASE_CONTEXT_ID to skip Grammarly login on subsequent runs.
- **Self-healing**: Stagehand's selfHeal option handles DOM changes automatically.
- **Model selection**: Separate LLM providers for Stagehand (browser) and rewriting (text). Claude auto-selects based on text length and iteration count: Haiku (<3k chars, ≤3 iterations), Sonnet (default), Opus (>12k chars or >8 iterations).
- **Null scores**: Grammarly features may return null without Premium subscription.

## Environment Variables

### Environment Isolation

- `IGNORE_SYSTEM_ENV` - When `true`, ignores shell env vars and uses only `.env` file. Prevents IDE-inherited env pollution.

### Provider Config

- `BROWSER_PROVIDER` - `stagehand` (default) or `browser-use`

### Stagehand (when BROWSER_PROVIDER=stagehand)

- `BROWSERBASE_API_KEY` - Required. From browserbase.com
- `BROWSERBASE_PROJECT_ID` - Required. From Browserbase dashboard
- `BROWSERBASE_CONTEXT_ID` - Optional. Persistent login context
- `BROWSERBASE_SESSION_ID` - Optional. Reuse existing session
- `STAGEHAND_MODEL` - Deprecated. Use `STAGEHAND_LLM_PROVIDER` + model vars instead
- `STAGEHAND_CACHE_DIR` - Optional. Action caching directory

### 1Password Integration (optional)

- `OP_SERVICE_ACCOUNT_TOKEN` - 1Password service account token for auto-login
- `OP_GRAMMARLY_SECRET_REF` - Secret reference path (default: `op://Browserbase Agent/Grammarly`)

When configured, the server automatically logs into Grammarly for fresh contexts using credentials from 1Password.
Falls back to manual login if auto-login fails (wrong credentials, CAPTCHA, rate limit).

### Browser Use (when BROWSER_PROVIDER=browser-use)

- `BROWSER_USE_API_KEY` - Required. From cloud.browser-use.com
- `BROWSER_USE_PROFILE_ID` - Required. Synced profile with Grammarly login

### LLM Provider Controls

Separate LLM providers for browser automation and text rewriting:

- `STAGEHAND_LLM_PROVIDER` - LLM for browser automation: `claude-code` | `openai` | `google` | `anthropic`
- `REWRITE_LLM_PROVIDER` - LLM for text rewriting: `claude-code` | `openai` | `google` | `anthropic`

If not set, auto-detects from API keys (OpenAI > Google > Anthropic > Claude Code).

### Model Selection

- `CLAUDE_MODEL` - `auto` (default) | `haiku` | `sonnet` | `opus`. Auto-selects based on text length and iteration count.
- `ANTHROPIC_MODEL` - Anthropic model id for direct provider (default: `claude-sonnet-4-20250514`).
- `OPENAI_MODEL` - OpenAI model (default: `gpt-4o`)
- `GOOGLE_MODEL` - Google model (default: `gemini-2.5-flash`)

### API Keys

- `CLAUDE_API_KEY` - Optional. Falls back to `claude login` CLI auth
- `OPENAI_API_KEY` - Required for OpenAI provider
- `GOOGLE_GENERATIVE_AI_API_KEY` - Required for Google provider. Also accepts `GEMINI_API_KEY`
- `ANTHROPIC_API_KEY` - Required for direct Anthropic provider

### General

- `LOG_LEVEL` - debug | info | warn | error (default: info)
- `LLM_REQUEST_TIMEOUT_MS` - LLM request timeout (default: 120000). `CLAUDE_REQUEST_TIMEOUT_MS` remains supported for backwards compatibility.
- `CONNECT_TIMEOUT_MS` - Browser connection timeout (default: 30000)

## Key Files

| File                                      | Purpose                                    |
| ----------------------------------------- | ------------------------------------------ |
| `src/browser/provider.ts`                 | Provider interface and factory function    |
| `src/browser/stagehand/index.ts`          | StagehandProvider implementation           |
| `src/browser/stagehand/sessionManager.ts` | Browserbase session/context lifecycle      |
| `src/browser/stagehand/grammarlyTask.ts`  | Grammarly automation (observe/act/extract) |
| `src/browser/stagehand/grammarlyLogin.ts` | 1Password auto-login automation            |
| `src/browser/stagehand/schemas.ts`        | Zod schemas for score extraction           |
| `src/auth/onePasswordProvider.ts`         | 1Password SDK client and credential fetch  |
| `src/browser/browserUseProvider.ts`       | Browser Use provider (fallback)            |
| `src/llm/stagehandLlm.ts`                 | Multi-provider LLM client for Stagehand    |
| `src/llm/rewriteClient.ts`                | Multi-provider LLM client for text rewriting |
| `src/grammarlyOptimizer.ts`               | Main optimization loop with retry logic    |
| `src/config.ts`                           | Environment validation and AppConfig       |
