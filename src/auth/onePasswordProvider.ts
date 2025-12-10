import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Client, createClient } from "@1password/sdk";
import type { AppConfig } from "../config";
import { log } from "../config";

// Integration metadata for 1Password SDK
const INTEGRATION_NAME = "Grammarly MCP Server";

// Lazy-load version from package.json to avoid blocking module initialization
let cachedIntegrationVersion: string | undefined;

function getIntegrationVersion(): string {
  if (cachedIntegrationVersion === undefined) {
    const Filename = fileURLToPath(import.meta.url);
    const Dirname = path.dirname(Filename);
    const packageJsonPath = path.join(Dirname, "../../package.json");
    const packageJsonContent = JSON.parse(
      fs.readFileSync(packageJsonPath, "utf-8"),
    );
    cachedIntegrationVersion = packageJsonContent.version as string;
  }
  return cachedIntegrationVersion as string;
}

// Default secret reference path (matches Browserbase docs example)
const DEFAULT_SECRET_REF = "op://Browserbase Agent/Grammarly";

/**
 * Credentials retrieved from 1Password for Grammarly login.
 * SECURITY: Never log these values.
 */
export interface GrammarlyCredentials {
  username: string;
  password: string;
}

/**
 * Options for 1Password credential fetching.
 */
export interface OnePasswordOptions {
  /** Service account token (OP_SERVICE_ACCOUNT_TOKEN) */
  serviceAccountToken: string;
  /** Secret reference path (default: "op://Browserbase Agent/Grammarly") */
  secretRefPath?: string;
}

/**
 * Check if 1Password integration is configured.
 * Returns true only when OP_SERVICE_ACCOUNT_TOKEN is set.
 */
export function isOnePasswordConfigured(
  config: Pick<AppConfig, "opServiceAccountToken">,
): boolean {
  return !!config.opServiceAccountToken;
}

/**
 * Create a 1Password SDK client.
 * Client initialization is async and may fail if token is invalid.
 *
 * @throws Error if initialization fails (invalid token, network issues)
 */
export async function createOnePasswordClient(
  serviceAccountToken: string,
): Promise<Client> {
  log("debug", "Initializing 1Password SDK client");

  try {
    const client = await createClient({
      auth: serviceAccountToken,
      integrationName: INTEGRATION_NAME,
      integrationVersion: getIntegrationVersion(),
    });

    log("debug", "1Password client initialized successfully");
    return client;
  } catch (error) {
    log("error", "Failed to initialize 1Password client", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error(
      `1Password SDK initialization failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

/**
 * Fetch Grammarly credentials from 1Password.
 *
 * Expected 1Password item structure:
 * - Vault: "Browserbase Agent" (or as specified in secretRefPath)
 * - Item: "Grammarly" (or as specified in secretRefPath)
 * - Fields: "username" and "password"
 *
 * Secret reference format: op://VaultName/ItemName/field
 *
 * @throws Error if credentials cannot be resolved
 */
export async function getGrammarlyCredentials(
  options: OnePasswordOptions,
): Promise<GrammarlyCredentials> {
  const basePath = options.secretRefPath ?? DEFAULT_SECRET_REF;

  log("debug", "Fetching Grammarly credentials from 1Password", {
    secretRefPath: basePath,
  });

  const client = await createOnePasswordClient(options.serviceAccountToken);

  try {
    // Resolve username and password fields in parallel
    const [username, password] = await Promise.all([
      client.secrets.resolve(`${basePath}/username`),
      client.secrets.resolve(`${basePath}/password`),
    ]);

    if (!username || !password) {
      throw new Error("Username or password field is empty in 1Password item");
    }

    log("info", "Successfully retrieved Grammarly credentials from 1Password");

    // SECURITY: Never log credential values
    return { username, password };
  } catch (error) {
    log("error", "Failed to fetch Grammarly credentials from 1Password", {
      secretRefPath: basePath,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error(
      `Failed to resolve 1Password secrets: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}
