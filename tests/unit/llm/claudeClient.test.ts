import { describe, expect, it } from "vitest";
import { chooseClaudeModel, RewriterToneSchema } from "../../../src/llm/claudeClient";

describe("chooseClaudeModel", () => {
	describe("selects sonnet for", () => {
		it.each([
			["short text, few iterations", 5000, 5],
			["boundary text length", 12000, 5],
			["boundary iterations", 5000, 8],
			["both at boundary", 12000, 8],
			["minimum values", 1, 1],
			["typical essay", 8000, 3],
		])("%s (%d chars, %d iterations)", (_, textLength, iterations) => {
			expect(chooseClaudeModel(textLength, iterations)).toBe("sonnet");
		});
	});

	describe("selects opus for", () => {
		it.each([
			["text just over threshold", 12001, 5],
			["iterations just over threshold", 5000, 9],
			["both over threshold", 15000, 10],
			["very long text", 20000, 3],
			["many iterations", 5000, 15],
			["extreme values", 50000, 20],
		])("%s (%d chars, %d iterations)", (_, textLength, iterations) => {
			expect(chooseClaudeModel(textLength, iterations)).toBe("opus");
		});
	});

	describe("boundary conditions", () => {
		it("12000 chars returns sonnet", () => {
			expect(chooseClaudeModel(12000, 5)).toBe("sonnet");
		});

		it("12001 chars returns opus", () => {
			expect(chooseClaudeModel(12001, 5)).toBe("opus");
		});

		it("8 iterations returns sonnet", () => {
			expect(chooseClaudeModel(5000, 8)).toBe("sonnet");
		});

		it("9 iterations returns opus", () => {
			expect(chooseClaudeModel(5000, 9)).toBe("opus");
		});
	});
});

describe("RewriterToneSchema", () => {
	const validTones = ["neutral", "formal", "informal", "academic", "custom"] as const;

	it.each(validTones)("accepts '%s' tone", (tone) => {
		const result = RewriterToneSchema.safeParse(tone);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(tone);
		}
	});

	it.each([
		"professional",
		"casual",
		"business",
		"",
		"NEUTRAL",
		123,
		null,
		undefined,
	])("rejects invalid value: %s", (invalidTone) => {
		const result = RewriterToneSchema.safeParse(invalidTone);
		expect(result.success).toBe(false);
	});
});
