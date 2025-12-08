import { defineConfig } from "vitest/config";

// Detect if running in CI with sharding (shards generate partial coverage)
const isShardedCIRun =
	process.env.CI &&
	process.argv.some((arg) => arg.startsWith("--shard=") || arg === "--shard");

export default defineConfig({
	test: {
		include: ["tests/**/*.test.ts"],
		exclude: ["**/node_modules/**"],
		environment: "node",
		globals: true,

		// Pool configuration: threads for fast parallel execution
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
			reporter: ["text", "json", "html", "lcov", "json-summary"],
			reportsDirectory: "./coverage",
			include: ["src/**/*.ts"],
			exclude: [
				"src/server.ts", // Entry point with side effects
				"**/*.d.ts",
			],
			// Coverage thresholds: disabled for sharded CI runs (partial coverage).
			// Thresholds verified on merged coverage in coverage-report job.
			// Local runs and non-sharded CI runs enforce thresholds.
			thresholds: isShardedCIRun
				? undefined
				: {
						lines: 85,
						functions: 85,
						branches: 75,
						statements: 85,
					},
		},

		// Setup file
		setupFiles: ["./tests/setup.ts"],

		// Reporter configuration
		reporters: ["default"],
	},
});
