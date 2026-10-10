import "server-only";
import { Account, Client, TablesDB } from "node-appwrite";
import { getConfig, getServerKey } from "./config";

export function sessionAccount(secret: string): Account {
  const config = getConfig();
  return new Account(new Client().setEndpoint(config.endpoint).setProject(config.projectId).setSession(secret));
}

export function adminAccount(request: Request): Account {
  const config = getConfig();
  return new Account(new Client().setEndpoint(config.endpoint).setProject(config.projectId).setKey(getServerKey(request)));
}

export function serverTables(request?: Request): TablesDB {
  const config = getConfig();
  return new TablesDB(new Client().setEndpoint(config.endpoint).setProject(config.projectId).setKey(getServerKey(request)));
}
