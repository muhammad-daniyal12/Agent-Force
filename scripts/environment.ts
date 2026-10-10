import { existsSync } from "node:fs";
import { Client, TablesDB } from "node-appwrite";
import { getConfig, getServerKey } from "../src/lib/appwrite/config";

export function scriptEnvironment(provisioning = false) {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const config = getConfig();
  const key = provisioning
    ? process.env.APPWRITE_SETUP_API_KEY ||
      process.env.AGENTFORCE_APPWRITE_SETUP_API_KEY
    : getServerKey();
  if (!key || key.startsWith("replace_with_"))
    throw new Error(
      "Configure the private setup API key in .env.local. Do not use a schema-admin key in the deployed runtime.",
    );
  const db = new TablesDB(
    new Client()
      .setEndpoint(config.endpoint)
      .setProject(config.projectId)
      .setKey(key),
  );
  return { config, db };
}

export function reportScriptFailure(error: unknown) {
  // SDK messages can contain internal values. Print only safe operator instructions.
  const status =
    typeof error === "object" && error !== null && "code" in error
      ? Number(error.code)
      : undefined;
  console.error(
    status
      ? `Appwrite setup failed (HTTP ${status}). Check region, project ID, scopes, and schema compatibility.`
      : "Setup could not complete. Check .env.local configuration and the existing schema.",
  );
  process.exitCode = 1;
}
