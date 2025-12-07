import { vi } from "vitest";

/**
 * Creates a mock Playwright Page object with common methods stubbed.
 */
export function createMockPage() {
	return {
		goto: vi.fn().mockResolvedValue(undefined),
		url: vi.fn().mockReturnValue("https://app.grammarly.com"),
		waitForTimeout: vi.fn().mockResolvedValue(undefined),
		waitForLoadState: vi.fn().mockResolvedValue(undefined),
		evaluate: vi.fn().mockResolvedValue(undefined),
		content: vi.fn().mockResolvedValue("<html></html>"),
	};
}

/**
 * Creates a mock Stagehand instance with all primary methods stubbed.
 * Use `overrides` to customize specific method behaviors.
 */
export function createMockStagehand(overrides?: Record<string, unknown>) {
	const mockPage = createMockPage();

	return {
		init: vi.fn().mockResolvedValue(undefined),
		observe: vi
			.fn()
			.mockResolvedValue([{ description: "New document button" }]),
		act: vi.fn().mockResolvedValue(undefined),
		extract: vi.fn().mockResolvedValue({
			aiDetectionPercent: 15,
			plagiarismPercent: 3,
			notes: "Scores extracted successfully",
		}),
		close: vi.fn().mockResolvedValue(undefined),
		context: {
			pages: vi.fn().mockReturnValue([mockPage]),
		},
		page: mockPage,
		...overrides,
	};
}

/**
 * Creates a Stagehand mock that fails on specific methods.
 * Useful for testing error handling paths.
 */
export function createFailingStagehand(failingMethod: string, error?: Error) {
	const baseStagehand = createMockStagehand();
	const err = error ?? new Error(`Mock failure on ${failingMethod}`);

	if (failingMethod in baseStagehand) {
		(baseStagehand as Record<string, unknown>)[failingMethod] = vi
			.fn()
			.mockRejectedValue(err);
	}

	return baseStagehand;
}
