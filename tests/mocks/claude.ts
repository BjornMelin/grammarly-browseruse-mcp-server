import { vi } from "vitest";

/**
 * Creates a mock for Vercel AI SDK's generateObject function.
 */
export function mockGenerateObject<T>(result: T) {
	return vi.fn().mockResolvedValue({ object: result });
}

/**
 * Creates a mock for Vercel AI SDK's generateText function.
 */
export function mockGenerateText(text: string) {
	return vi.fn().mockResolvedValue({ text });
}

/**
 * Default rewrite result from Claude.
 */
export const defaultRewriteResult = {
	rewrittenText: "Rewritten text with lower AI detection.",
	reasoning: "Paraphrased key sentences and varied vocabulary.",
};

/**
 * Default analysis result from Claude.
 */
export const defaultAnalysisResult = {
	analysis:
		"Text shows signs of AI generation in formal sentence structure and uniform paragraph length.",
};

/**
 * Default summary result from Claude.
 */
export const defaultSummaryResult =
	"Optimization completed after 3 iterations. AI detection reduced from 45% to 8%, plagiarism reduced from 12% to 2%.";

/**
 * Creates a mock rewrite result with custom values.
 */
export function createMockRewriteResult(overrides?: {
	rewrittenText?: string;
	reasoning?: string;
}) {
	return {
		...defaultRewriteResult,
		...overrides,
	};
}

/**
 * Creates a mock generateObject that simulates timeout/failure scenarios.
 */
export function createFailingGenerateObject(error?: Error) {
	return vi
		.fn()
		.mockRejectedValue(error ?? new Error("Claude API request failed"));
}
