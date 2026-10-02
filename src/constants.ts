import os from "node:os";
import path from "node:path";

export const APP_NAME = "loadmoder";
export const APP_VERSION = "2.0.0";
export const GITHUB_USER = "hafiznovelrianto";

const contact = process.env.LOADMODER_CONTACT;
export const USER_AGENT = `${GITHUB_USER}/${APP_NAME}/${APP_VERSION}${contact ? ` (${contact})` : ""}`;

export const API_BASE_URL = process.env.MODRINTH_API_URL ?? "https://api.modrinth.com/v2";

export const GLOBAL_CONFIG_DIR =
  process.env.LOADMODER_HOME ?? path.join(os.homedir(), ".loadmoder");
export const GLOBAL_CONFIG_PATH = path.join(GLOBAL_CONFIG_DIR, "config.json");

export const SUPPORTED_LOADERS = ["fabric", "forge", "neoforge", "quilt"] as const;
export type SupportedLoader = (typeof SUPPORTED_LOADERS)[number];

export const PROJECT_TYPES = ["mod", "modpack", "resourcepack", "shader", "datapack"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];
