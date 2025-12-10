import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted to create mock functions before they're used in vi.mock factory
const { mockSecretsResolve, mockCreateClient } = vi.hoisted(() => ({
  mockSecretsResolve: vi.fn(),
  mockCreateClient: vi.fn(),
}));

// Mock @1password/sdk before importing the module under test
vi.mock("@1password/sdk", () => ({
  createClient: mockCreateClient,
}));

// Mock config to provide log function
vi.mock("../../../src/config", () => ({
  log: vi.fn(),
}));

// Import after mocking
import {
  isOnePasswordConfigured,
  createOnePasswordClient,
  getGrammarlyCredentials,
} from "../../../src/auth/onePasswordProvider";

describe("onePasswordProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isOnePasswordConfigured", () => {
    it("returns true when OP_SERVICE_ACCOUNT_TOKEN is set", () => {
      const config = { opServiceAccountToken: "ops_test_token" };
      expect(isOnePasswordConfigured(config)).toBe(true);
    });

    it("returns false when OP_SERVICE_ACCOUNT_TOKEN is undefined", () => {
      const config = { opServiceAccountToken: undefined };
      expect(isOnePasswordConfigured(config)).toBe(false);
    });

    it("returns false when OP_SERVICE_ACCOUNT_TOKEN is empty string", () => {
      const config = { opServiceAccountToken: "" };
      expect(isOnePasswordConfigured(config)).toBe(false);
    });
  });

  describe("createOnePasswordClient", () => {
    it("creates client with valid token", async () => {
      const mockClient = { secrets: { resolve: mockSecretsResolve } };
      mockCreateClient.mockResolvedValueOnce(mockClient);

      const client = await createOnePasswordClient("ops_test_token");

      expect(mockCreateClient).toHaveBeenCalledWith({
        auth: "ops_test_token",
        integrationName: "Grammarly MCP Server",
        integrationVersion: "0.1.0",
      });
      expect(client).toBe(mockClient);
    });

    it("throws on invalid token", async () => {
      mockCreateClient.mockRejectedValueOnce(new Error("Invalid token"));

      await expect(createOnePasswordClient("invalid_token")).rejects.toThrow(
        "1Password SDK initialization failed: Invalid token",
      );
    });

    it("wraps non-Error rejections in Error", async () => {
      mockCreateClient.mockRejectedValueOnce("string error");

      await expect(createOnePasswordClient("invalid_token")).rejects.toThrow(
        "1Password SDK initialization failed: unknown error",
      );
    });
  });

  describe("getGrammarlyCredentials", () => {
    const mockClient = {
      secrets: {
        resolve: mockSecretsResolve,
      },
    };

    beforeEach(() => {
      mockCreateClient.mockResolvedValue(mockClient);
    });

    it("resolves username and password from default path", async () => {
      mockSecretsResolve
        .mockResolvedValueOnce("test@example.com")
        .mockResolvedValueOnce("securePassword123");

      const credentials = await getGrammarlyCredentials({
        serviceAccountToken: "ops_test_token",
      });

      expect(credentials).toEqual({
        username: "test@example.com",
        password: "securePassword123",
      });

      expect(mockSecretsResolve).toHaveBeenCalledWith(
        "op://Browserbase Agent/Grammarly/username",
      );
      expect(mockSecretsResolve).toHaveBeenCalledWith(
        "op://Browserbase Agent/Grammarly/password",
      );
    });

    it("resolves from custom secret ref path", async () => {
      mockSecretsResolve
        .mockResolvedValueOnce("user@custom.com")
        .mockResolvedValueOnce("customPass");

      const credentials = await getGrammarlyCredentials({
        serviceAccountToken: "ops_test_token",
        secretRefPath: "op://MyVault/MyItem",
      });

      expect(credentials).toEqual({
        username: "user@custom.com",
        password: "customPass",
      });

      expect(mockSecretsResolve).toHaveBeenCalledWith(
        "op://MyVault/MyItem/username",
      );
      expect(mockSecretsResolve).toHaveBeenCalledWith(
        "op://MyVault/MyItem/password",
      );
    });

    it("throws when username field is empty", async () => {
      mockSecretsResolve
        .mockResolvedValueOnce("") // empty username
        .mockResolvedValueOnce("password");

      await expect(
        getGrammarlyCredentials({ serviceAccountToken: "ops_test_token" }),
      ).rejects.toThrow("Failed to resolve 1Password secrets");
    });

    it("throws when password field is empty", async () => {
      mockSecretsResolve
        .mockResolvedValueOnce("user@example.com")
        .mockResolvedValueOnce(""); // empty password

      await expect(
        getGrammarlyCredentials({ serviceAccountToken: "ops_test_token" }),
      ).rejects.toThrow("Failed to resolve 1Password secrets");
    });

    it("throws when secret resolution fails", async () => {
      mockSecretsResolve.mockRejectedValueOnce(
        new Error("Secret not found: op://Browserbase Agent/Grammarly/username"),
      );

      await expect(
        getGrammarlyCredentials({ serviceAccountToken: "ops_test_token" }),
      ).rejects.toThrow("Failed to resolve 1Password secrets");
    });

    it("throws when client initialization fails", async () => {
      mockCreateClient.mockRejectedValueOnce(new Error("Auth failed"));

      await expect(
        getGrammarlyCredentials({ serviceAccountToken: "invalid" }),
      ).rejects.toThrow("1Password SDK initialization failed");
    });
  });
});
