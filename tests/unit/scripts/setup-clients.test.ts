import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildMcpConfig,
  filterClientsForPlatform,
  generateJsonConfig,
  generateTomlConfig,
  parseEnvFile,
} from "../../../scripts/setup-clients";

const createTempDir = (): string => fs.mkdtempSync(path.join(os.tmpdir(), "setup-clients-"));

describe("parseEnvFile", () => {
  it("parses simple key-value pairs", () => {
    const dir = createTempDir();
    const envPath = path.join(dir, ".env");
    fs.writeFileSync(envPath, "FOO=bar\nBAZ=qux\n");

    expect(parseEnvFile(envPath)).toEqual({ FOO: "bar", BAZ: "qux" });

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("handles quoted values and skips comments/empty lines", () => {
    const dir = createTempDir();
    const envPath = path.join(dir, ".env");
    fs.writeFileSync(
      envPath,
      [
        "QUOTED=\"value with spaces\"",
        "# comment line",
        "",
        "PLAIN=bare",
        "EMPTY=",
      ].join("\n"),
    );

    expect(parseEnvFile(envPath)).toEqual({ QUOTED: "value with spaces", PLAIN: "bare", EMPTY: "" });

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("returns empty object when file is missing", () => {
    const dir = createTempDir();
    const envPath = path.join(dir, "absent.env");

    expect(parseEnvFile(envPath)).toEqual({});

    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("buildMcpConfig", () => {
  it("keeps required/optional env vars and drops empty or unknown keys", () => {
    const invocation = { command: "node", args: ["dist/server.js"] } as const;
    const envVars = {
      BROWSER_PROVIDER: "stagehand",
      BROWSERBASE_API_KEY: "base-key",
      BROWSERBASE_PROJECT_ID: "project-id",
      BROWSER_USE_API_KEY: "", // ignored because empty
      BROWSER_USE_PROFILE_ID: "profile-id",
      LOG_LEVEL: "debug", // optional
      EXTRA_KEY: "should-be-dropped",
    } as const;

    const result = buildMcpConfig(invocation, envVars);

    expect(result.command).toBe("node");
    expect(result.args).toEqual(["dist/server.js"]);
    expect(result.env).toEqual({
      BROWSER_PROVIDER: "stagehand",
      BROWSERBASE_API_KEY: "base-key",
      BROWSERBASE_PROJECT_ID: "project-id",
      BROWSER_USE_PROFILE_ID: "profile-id",
      LOG_LEVEL: "debug",
    });
  });
});

describe("generateJsonConfig", () => {
  it("creates config when none exists", () => {
    const mcpConfig = {
      command: "node",
      args: ["dist/server.js"],
      env: { KEY: "value" },
    };

    const json = generateJsonConfig(null, mcpConfig);
    const parsed = JSON.parse(json) as Record<string, unknown>;

    expect(parsed.mcpServers).toBeDefined();
    expect((parsed.mcpServers as Record<string, unknown>).grammarly).toEqual(mcpConfig);
  });

  it("merges with existing config and preserves other servers", () => {
    const existing = {
      theme: "dark",
      mcpServers: {
        existing: { command: "node", args: ["existing"], env: { OLD: "1" } },
      },
    };
    const mcpConfig = {
      command: "node",
      args: ["dist/server.js"],
      env: { NEW: "yes" },
    };

    const parsed = JSON.parse(generateJsonConfig(existing, mcpConfig));

    expect(parsed.theme).toBe("dark");
    expect(parsed.mcpServers.existing).toEqual({ command: "node", args: ["existing"], env: { OLD: "1" } });
    expect(parsed.mcpServers.grammarly).toEqual(mcpConfig);
  });
});

describe("generateTomlConfig", () => {
  it("generates grammarly section with escaped values", () => {
    const mcpConfig = {
      command: "node",
      args: ["dist/server.js"],
      env: { API_KEY: "abc", PATH: "C\\path" },
    };

    const toml = generateTomlConfig(null, mcpConfig, "use local dist");

    expect(toml).toContain("[mcp_servers.grammarly]");
    expect(toml).toContain('command = "node"');
    expect(toml).toContain('args = ["dist/server.js"]');
    expect(toml).toContain("# use local dist");
    expect(toml).toContain('[mcp_servers.grammarly.env]');
    expect(toml).toContain('API_KEY = "abc"');
    expect(toml).toContain('PATH = "C\\\\path"');
  });

  it("preserves other sections and replaces prior grammarly block", () => {
    const existing = [
      "[profile]",
      'name = "default"',
      "",
      "[mcp_servers.grammarly]",
      'command = "old"',
      "",
      "[other]",
      'value = "1"',
      "",
    ].join("\n");

    const mcpConfig = {
      command: "npx",
      args: ["grammarly-mcp-server"],
      env: { TOKEN: "new" },
    };

    const toml = generateTomlConfig(existing, mcpConfig);
    const grammarlyMatches = toml.match(/\[mcp_servers\.grammarly\]/g) ?? [];

    expect(grammarlyMatches).toHaveLength(1);
    expect(toml).toContain("[profile]");
    expect(toml).toContain('name = "default"');
    expect(toml).toContain("[other]");
    expect(toml).toContain('value = "1"');
    expect(toml).toContain('command = "npx"');
    expect(toml).not.toContain('command = "old"');
  });
});

describe("filterClientsForPlatform", () => {
  const sampleClients = [
    { name: "Client (macOS)", configPath: "a", format: "json", description: "" },
    { name: "Client (Linux)", configPath: "b", format: "json", description: "" },
    { name: "Client (Windows)", configPath: "c", format: "json", description: "" },
    { name: "Client", configPath: "d", format: "json", description: "" },
  ];

  it("excludes macOS-specific entries on linux", () => {
    const available = filterClientsForPlatform("linux", sampleClients);
    expect(available.every((c) => !c.name.includes("(macOS)"))).toBe(true);
  });

  it("excludes linux entries on darwin", () => {
    const available = filterClientsForPlatform("darwin", sampleClients);
    expect(available.every((c) => !c.name.includes("(Linux)"))).toBe(true);
  });

  it("excludes both linux and macOS entries on win32", () => {
    const available = filterClientsForPlatform("win32", sampleClients);
    expect(available.some((c) => c.name.includes("(Linux)") || c.name.includes("(macOS)"))).toBe(false);
    expect(available.map((c) => c.name)).toContain("Client (Windows)");
  });
});
