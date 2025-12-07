import { vi } from "vitest";

/**
 * Creates a mock Browser Use session result.
 */
export function createMockBrowserUseSession(overrides?: Record<string, unknown>) {
	return {
		sessionId: "bu-session-12345",
		liveUrl: "https://live.browser-use.com/sessions/bu-session-12345",
		status: "running" as const,
		...overrides,
	};
}

/**
 * Creates a mock Browser Use task result.
 */
export function createMockBrowserUseTaskResult(
	overrides?: Record<string, unknown>,
) {
	return {
		success: true,
		output: {
			aiDetectionPercent: 15,
			plagiarismPercent: 3,
		},
		steps: 5,
		...overrides,
	};
}

/**
 * Creates a mock Browser Use client with all primary methods stubbed.
 */
export function createMockBrowserUseClient(overrides?: Record<string, unknown>) {
	return {
		createSession: vi.fn().mockResolvedValue(createMockBrowserUseSession()),
		runTask: vi.fn().mockResolvedValue(createMockBrowserUseTaskResult()),
		getSession: vi.fn().mockResolvedValue(createMockBrowserUseSession()),
		closeSession: vi.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

/**
 * Creates a failing Browser Use client for error testing.
 */
export function createFailingBrowserUseClient(
	failingMethod: string,
	error?: Error,
) {
	const baseClient = createMockBrowserUseClient();
	const err = error ?? new Error(`Mock failure on ${failingMethod}`);

	if (failingMethod in baseClient) {
		(baseClient as Record<string, unknown>)[failingMethod] = vi
			.fn()
			.mockRejectedValue(err);
	}

	return baseClient;
}
