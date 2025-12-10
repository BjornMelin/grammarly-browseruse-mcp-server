/**
 * Authentication module for credential management.
 * Currently provides 1Password integration for automatic Grammarly login.
 */
export {
  createOnePasswordClient,
  type GrammarlyCredentials,
  getGrammarlyCredentials,
  isOnePasswordConfigured,
  type OnePasswordOptions,
} from "./onePasswordProvider";
