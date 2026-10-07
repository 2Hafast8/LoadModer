import path from "node:path";
import {mkdir, readdir, readFile, stat} from "node:fs/promises";
import writeFileAtomic from "write-file-atomic";
import {isTLauncherPreservedEngineItem} from "./preservedItems.js";
import type {ClientContainerInfo, ResolvedContainer} from "../profileManager.js";

export {isTLauncherPreservedEngineItem};

/**
 * Menemukan seluruh wadah versi client TLauncher di folder versions (.minecraft/versions).
 */
export async function discoverTLauncherContainers(
  baseDir?: string,
  syncProfilesFromDownloads?: (containerDir: string) => Promise<unknown>,
  listProfiles?: (containerDir: string) => Promise<unknown[]>,
  getActiveProfile?: (containerDir: string) => Promise<{name?: string; activeProfile?: string | null} | null>,
): Promise<ClientContainerInfo[]> {
  let versionsDir: string | null = null;
  if (baseDir) {
    if (path.basename(path.dirname(baseDir)).toLowerCase() === "versions") {
      versionsDir = path.dirname(baseDir);
    } else {
      const candidate = path.join(baseDir, "versions");
      try {
        const s = await stat(candidate);
        if (s.isDirectory()) versionsDir = candidate;
      } catch {}
    }
  }

  if (!versionsDir) {
    const appData =
      process.env.APPDATA ?? path.join(process.env.USERPROFILE ?? "", "AppData", "Roaming");
    const defaultVersions = path.join(appData, ".minecraft", "versions");
    try {
      const s = await stat(defaultVersions);
      if (s.isDirectory()) versionsDir = defaultVersions;
    } catch {}
  }

  if (!versionsDir) return [];

  const containers: ClientContainerInfo[] = [];
  try {
    const entries = await readdir(versionsDir, {withFileTypes: true});
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const cName = entry.name;
      const lower = cName.toLowerCase();

      const cDir = path.join(versionsDir, cName);
      const tlJsonPath = path.join(cDir, "TLauncherAdditional.json");
      let isCandidate = lower.startsWith("mypack");
      let loader: "fabric" | "forge" | "neoforge" | "quilt" = lower.includes("fabric")
        ? "fabric"
        : "forge";

      let gameVersion = "1.20.1";

      try {
        const raw = await readFile(tlJsonPath, "utf8");
        const tlJson = JSON.parse(raw);
        if (tlJson?.modpack) {
          isCandidate = true;
          if (tlJson.modpack.version?.gameVersionDTO?.name) {
            gameVersion = tlJson.modpack.version.gameVersionDTO.name;
          }
          const loaderTypes = tlJson.modpack.version?.minecraftVersionTypes;
          if (Array.isArray(loaderTypes)) {
            for (const lt of loaderTypes) {
              const name = lt.name?.toLowerCase() ?? "";
              if (name.includes("fabric")) loader = "fabric";
              else if (name.includes("neoforge")) loader = "neoforge";
              else if (name.includes("forge")) loader = "forge";
              else if (name.includes("quilt")) loader = "quilt";
            }
          }
        }
      } catch {}

      if (gameVersion === "1.20.1") {
        try {
          const verRaw = await readFile(path.join(cDir, `${cName}.json`), "utf8");
          const verJson = JSON.parse(verRaw);
          if (verJson?.inheritsFrom) {
            gameVersion = verJson.inheritsFrom;
          }
        } catch {}
      }

      if (isCandidate) {
        if (syncProfilesFromDownloads) {
          await syncProfilesFromDownloads(cDir);
        }
        const profiles = listProfiles ? await listProfiles(cDir) : [];
        const activeInfo = getActiveProfile ? await getActiveProfile(cDir) : null;

        containers.push({
          containerName: cName,
          containerDir: cDir,
          loader,
          gameVersion,
          profilesCount: profiles.length,
          activeProfileName: activeInfo?.name ?? activeInfo?.activeProfile ?? null,
        });
      }
    }
  } catch {}

  return containers.sort(
    (a, b) =>
      a.loader.localeCompare(b.loader) ||
      a.gameVersion.localeCompare(b.gameVersion) ||
      a.containerName.localeCompare(b.containerName),
  );
}

/**
 * Mencari atau memetakan wadah versi TLauncher (mypack) yang cocok untuk loader dan versi game.
 */
export async function resolveTLauncherContainerForLoader(
  baseInstanceDir: string,
  loader?: string,
  gameVersion?: string,
): Promise<ResolvedContainer> {
  const normLoader = (loader ?? "").toLowerCase();
  const isFabric = normLoader.includes("fabric") || normLoader.includes("quilt");
  const matchedLoader: "fabric" | "forge" = isFabric ? "fabric" : "forge";

  let versionsDir: string | null = null;
  const parentDir = path.dirname(baseInstanceDir);
  if (path.basename(parentDir).toLowerCase() === "versions") {
    versionsDir = parentDir;
  } else {
    const candidateVersions = path.join(baseInstanceDir, "versions");
    try {
      const s = await stat(candidateVersions);
      if (s.isDirectory()) {
        versionsDir = candidateVersions;
      }
    } catch {}
  }

  if (!versionsDir) {
    return {
      containerDir: baseInstanceDir,
      containerName: path.basename(baseInstanceDir),
      matchedLoader,
    };
  }

  let entries: string[] = [];
  try {
    const dirEntries = await readdir(versionsDir, {withFileTypes: true});
    entries = dirEntries.filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {}

  let chosenContainerName: string | null = null;

  if (matchedLoader === "fabric") {
    const versionCandidate = gameVersion
      ? entries.find((e) => {
          const lower = e.toLowerCase();
          return (
            lower.includes("mypack") &&
            lower.includes("fabric") &&
            lower.includes(gameVersion.toLowerCase())
          );
        })
      : null;

    const baseCandidate = !gameVersion || gameVersion === "1.20.1"
      ? entries.find((e) => {
          const lower = e.toLowerCase();
          return lower.includes("mypack") && lower.includes("fabric") && !/\d+\.\d+/.test(lower);
        })
      : null;

    const fabricCandidate = versionCandidate ?? baseCandidate;

    if (fabricCandidate) {
      chosenContainerName = fabricCandidate;
    } else {
      const usesParens = entries.some((e) => e.toLowerCase().includes("mypack("));
      const verSuffix = gameVersion && gameVersion !== "1.20.1" ? `-${gameVersion}` : "";
      chosenContainerName = usesParens ? `mypack(fabric${verSuffix})` : `mypack-fabric${verSuffix}`;
    }
  } else {
    const versionCandidate = gameVersion
      ? entries.find((e) => {
          const lower = e.toLowerCase();
          return (
            lower.includes("mypack") &&
            (lower.includes("forge") || lower === "mypack") &&
            lower.includes(gameVersion.toLowerCase())
          );
        })
      : null;

    const baseCandidate = !gameVersion || gameVersion === "1.20.1"
      ? entries.find((e) => {
          const lower = e.toLowerCase();
          return (
            lower.includes("mypack") &&
            (lower.includes("forge") || lower === "mypack") &&
            !/\d+\.\d+/.test(lower)
          );
        })
      : null;

    const forgeCandidate = versionCandidate ?? baseCandidate;

    if (forgeCandidate) {
      chosenContainerName = forgeCandidate;
    } else {
      const usesParens = entries.some((e) => e.toLowerCase().includes("mypack("));
      const verSuffix = gameVersion && gameVersion !== "1.20.1" ? `-${gameVersion}` : "";
      chosenContainerName = usesParens ? `mypack(forge${verSuffix})` : `mypack${verSuffix}`;
    }
  }

  const targetContainerDir = path.join(versionsDir, chosenContainerName);
  await mkdir(targetContainerDir, {recursive: true});

  const tlJsonPath = path.join(targetContainerDir, "TLauncherAdditional.json");
  try {
    await stat(tlJsonPath);
  } catch {
    const defaultTlAdditional = {
      modpack: {
        name: chosenContainerName,
        version: {
          gameVersionDTO: {
            name: gameVersion ?? "1.20.1",
          },
          minecraftVersionTypes: [
            {
              name: matchedLoader,
            },
          ],
        },
      },
    };
    await writeFileAtomic(tlJsonPath, JSON.stringify(defaultTlAdditional, null, 2), "utf8");
  }

  const verJsonPath = path.join(targetContainerDir, `${chosenContainerName}.json`);
  try {
    await stat(verJsonPath);
  } catch {
    const defaultVerJson = {
      id: chosenContainerName,
      inheritsFrom: gameVersion ?? "1.20.1",
      type: "custom",
    };
    await writeFileAtomic(verJsonPath, JSON.stringify(defaultVerJson, null, 2), "utf8");
  }

  return {
    containerDir: targetContainerDir,
    containerName: chosenContainerName,
    matchedLoader,
  };
}

