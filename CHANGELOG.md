# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Security

- **CRITICAL**: Fixed prompt injection vulnerability in text input
  - User text is no longer embedded in `stagehand.act()` LLM prompts
  - All text input now uses secure `locator.fill()` method regardless of length
  - Prevents prompt injection attacks and PII leakage to Stagehand's LLM context

### Added

- **Shared utilities module** (`src/utils/`):
  - `sleep(ms)` - Promise-based sleep utility
  - `withTimeout(fn, ms, onTimeout?)` - Generic timeout wrapper for async operations
  - `TimeoutError` - Typed error for timeout failures

- **ActionSchema** - Stagehand V3-compliant schema for `observe()` return type
  - Matches actual Stagehand V3 `Action` interface (XPath selectors, method, arguments)
  - `ObservationSchema` preserved as backward-compatible alias

- **Document cleanup** - `cleanupGrammarlyDocument()` now wired into scoring flow
  - Automatically cleans up Grammarly workspace after scoring
  - Prevents document accumulation on repeated calls

### Changed

- **Refactored timeout handling** in `rewriteClient.ts`
  - `rewriteText()`, `analyzeText()`, and `summarizeOptimization()` now use `withTimeout()`
  - Cleaner error handling with proper cleanup

- **Consolidated duplicate code**:
  - Removed duplicate `sleep()` functions from `grammarlyTask.ts` and `grammarlyLogin.ts`
  - Both now import from shared `src/utils/`

### Fixed

- **ObservationSchema** now matches Stagehand V3's actual API
  - Changed from CSS selectors to XPath selectors
  - Removed non-existent `visible` and `interactable` fields
  - Added proper `method` and `arguments` optional fields
