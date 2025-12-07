// Set required environment variables BEFORE any imports
// These must be set at the top level since config.ts validates on import
process.env.BROWSER_PROVIDER = "stagehand";
process.env.BROWSERBASE_API_KEY = "test-api-key";
process.env.BROWSERBASE_PROJECT_ID = "test-project-id";
process.env.BROWSER_USE_API_KEY = "test-browser-use-key";
process.env.BROWSER_USE_PROFILE_ID = "test-profile-id";
process.env.LOG_LEVEL = "error"; // Suppress logs in tests

import { afterEach, beforeEach, vi } from "vitest";

// Reset mocks between tests for isolation
beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	vi.restoreAllMocks();
});
