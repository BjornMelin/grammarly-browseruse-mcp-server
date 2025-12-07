import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["tests/**/*.test.ts"],
		exclude: ["**/node_modules/**"],
		environment: "node",
		globals: true,

		// Pool configuration: threads for unit tests (fast), forks for integration (isolation)
		pool: "threads",
		poolOptions: {
			threads: { singleThread: false },
		},

		// Timeouts
		testTimeout: 5000,
		hookTimeout: 10000,

		// Mocking behavior
		clearMocks: true,
		restoreMocks: true,

		// Coverage configuration
		coverage: {
			provider: "v8",
			enabled: false, // Enable via --coverage flag
			reporter: ["text", "json", "html", "lcov"],
			reportsDirectory: "./coverage",
			include: ["src/**/*.ts"],
			exclude: [
				"src/server.ts", // Entry point with side effects
				"**/*.d.ts",
			],
			// Coverage thresholds are staged: raise by ~10% each milestone.
			// Owner: tooling team; next bump due 2026-01-31 after adding orchestration tests.
			thresholds: {
				lines: 70,
				functions: 70,
				branches: 60,
				statements: 70,
			},
		},

		// Setup file
		setupFiles: ["./tests/setup.ts"],

		// Reporter configuration
		reporters: ["default"],
	},
});
