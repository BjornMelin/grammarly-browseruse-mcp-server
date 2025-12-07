import { describe, expect, it } from "vitest";

/**
 * Integration tests for StagehandProvider.
 *
 * Note: Full integration tests require complex module mocking that conflicts with
 * the eager validation in BrowserbaseSessionManager's constructor. These tests
 * are kept minimal and focused on interface compliance.
 *
 * For comprehensive provider testing, use:
 * - End-to-end tests with real credentials (in CI with secrets)
 * - Manual testing via the MCP server
 */
describe("StagehandProvider interface compliance", () => {
	it("exports StagehandProvider class", async () => {
		// Dynamic import to avoid constructor side effects
		const mod = await import("../../src/browser/stagehand");
		expect(mod.StagehandProvider).toBeDefined();
		expect(typeof mod.StagehandProvider).toBe("function");
	});

	it("exports BrowserbaseSessionManager class", async () => {
		const mod = await import("../../src/browser/stagehand");
		expect(mod.BrowserbaseSessionManager).toBeDefined();
		expect(typeof mod.BrowserbaseSessionManager).toBe("function");
	});

	it("exports GrammarlyExtractSchema", async () => {
		const mod = await import("../../src/browser/stagehand");
		expect(mod.GrammarlyExtractSchema).toBeDefined();
	});

	it("exports runStagehandGrammarlyTask function", async () => {
		const mod = await import("../../src/browser/stagehand");
		expect(mod.runStagehandGrammarlyTask).toBeDefined();
		expect(typeof mod.runStagehandGrammarlyTask).toBe("function");
	});
});

describe("StagehandProvider implements BrowserProvider interface", () => {
	it("has required properties and methods", async () => {
		const mod = await import("../../src/browser/stagehand");
		const instance = Object.getOwnPropertyNames(mod.StagehandProvider.prototype);

		// Check interface methods exist
		expect(instance).toContain("createSession");
		expect(instance).toContain("scoreText");
		expect(instance).toContain("closeSession");
	});
});
