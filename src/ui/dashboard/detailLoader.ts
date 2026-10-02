import path from "node:path";
import {stat} from "node:fs/promises";
import {modrinthClient} from "../../api/client.js";
import {instanceConfig} from "../../core/instance/config.js";
import {DependencyGraph} from "../../core/dependency/graph.js";
import {formatBytes} from "../../utils/format.js";
import {hashFile} from "../../utils/crypto.js";
import {computeModCompatibility} from "../../core/minecraft/compatibility.js";
import {getRequiredDependencyTitles} from "../../core/dependency/resolver.js";
import {showBanner, clearScreen} from "../theme.js";
import {askInteractiveMenu, ask, getMinecraftVersionChoices, type InteractiveChoice} from "../interactive.js";
import {p, pc} from "../prompts.js";
import type {SavedInstanceConfig} from "../../types/instance.js";
import type {ModProject, ModVersion} from "../../types/modrinth.js";
import type {ComprehensiveModDetail} from "./detailCard.js";

export async function ensureInstanceEnvironment(
  activeInstance?: SavedInstanceConfig,
): Promise<{loader: string; gameVersion: string}> {
  await instanceConfig.load();
  const freshInstance = instanceConfig.getActiveInstance() ?? activeInstance;
  let loader = freshInstance?.loader;
  let gameVersion = freshInstance?.gameVersion;

  if (!loader || !gameVersion) {
    clearScreen();
    showBanner(freshInstance?.name, true);
    p.log.warn("Instance ini belum memiliki Mod Loader / Versi Minecraft yang ditentukan.");
    p.log.message(
      pc.dim(
        "LoadModer perlu memastikan versi game dan loader Anda agar otomatis menyesuaikan versi mod yang kompatibel.",
      ),
    );

    if (!loader) {
      const loaderChoices: InteractiveChoice[] = [
        {name: "Fabric (Direkomendasikan)", value: "fabric"},
        {name: "NeoForge (Minecraft modern)", value: "neoforge"},
        {name: "Forge (Ekosistem luas)", value: "forge"},
        {name: "Quilt", value: "quilt"},
      ];
      const pickedLoader = await askInteractiveMenu(
        "Pilih Mod Loader Instance Anda:",
        loaderChoices,
      );
      loader = pickedLoader || "fabric";
    }

    if (!gameVersion) {
      const vChoices = await getMinecraftVersionChoices();
      vChoices.push({name: "──────────────────", value: "sep"});
      vChoices.push({name: "✏️   Ketik Versi Minecraft Lainnya...", value: "custom"});
      const pickedVer = await askInteractiveMenu("Pilih Versi Minecraft Instance Anda:", vChoices);
      if (pickedVer === "custom") {
        const customInput = await ask("Masukkan versi Minecraft (misal: 1.20.6 atau 26.2):");
        gameVersion = customInput?.trim() || "1.21.1";
      } else {
        gameVersion = pickedVer || "1.21.1";
      }
    }

    if (freshInstance) {
      freshInstance.loader = loader;
      freshInstance.gameVersion = gameVersion;
      await instanceConfig.load();
      const cfg = instanceConfig.get();
      if (cfg.activeInstance) {
        instanceConfig.saveInstance(cfg.activeInstance, freshInstance, true);
        await instanceConfig.save();
      }
    }
  }

  return {loader: loader || "fabric", gameVersion: gameVersion || "1.21.1"};
}

export async function buildInstalledModDetail(
  filename: string,
  modsDir: string,
  instanceDir: string,
  activeInstance?: SavedInstanceConfig,
): Promise<ComprehensiveModDetail> {
  const filePath = path.join(modsDir, filename);
  const isDisabled = filename.endsWith(".disabled");
  const cleanFileName = filename.replace(".disabled", "");

  let fileSizeBytes = 0;
  let fileSizeStr = "0 B";
  let modifiedAt: string | undefined;
  let sha1 = "";

  try {
    const s = await stat(filePath);
    fileSizeBytes = s.size;
    fileSizeStr = formatBytes(s.size);
    modifiedAt = s.mtime.toLocaleString();
    sha1 = await hashFile(filePath, "sha1");
  } catch {}

  const graph = new DependencyGraph(instanceDir);
  await graph.load();

  const lockEntryPair = Object.entries(graph.data.mods).find(
    ([slug, entry]) =>
      entry.filename === filename ||
      entry.filename === cleanFileName ||
      slug.toLowerCase() === cleanFileName.replace(".jar", "").toLowerCase(),
  );

  const detail: ComprehensiveModDetail = {
    title: cleanFileName.replace(".jar", ""),
    filename,
    filePath,
    fileSizeBytes,
    fileSizeStr,
    sha1,
    status: isDisabled ? "disabled" : "active",
    isInstalled: true,
    projectType: "mod",
    modifiedAt,
    isRoot: lockEntryPair ? lockEntryPair[1].isRoot : undefined,
    slug: lockEntryPair ? lockEntryPair[0] : undefined,
    projectId: lockEntryPair ? lockEntryPair[1].projectId : undefined,
    versionNumber: lockEntryPair ? lockEntryPair[1].versionNumber : undefined,
    installedVersion: lockEntryPair ? lockEntryPair[1].versionNumber : undefined,
    dependencies: lockEntryPair ? lockEntryPair[1].dependencies : [],
    dependedBy: lockEntryPair ? lockEntryPair[1].dependedBy : [],
    installedAt: lockEntryPair ? lockEntryPair[1].installedAt : undefined,
    sha512: lockEntryPair ? lockEntryPair[1].sha512 : undefined,
  };

  try {
    let project: ModProject | null = null;

    if (detail.slug || detail.projectId) {
      project = await modrinthClient.getProject(detail.slug || detail.projectId!);
    } else if (sha1) {
      const versionMap = await modrinthClient.getVersionsByHashes([sha1]);
      const ver = versionMap[sha1];
      if (ver) {
        detail.installedVersion = detail.installedVersion || ver.version_number;
        detail.versionNumber = ver.version_number;
        detail.projectId = ver.project_id;
        detail.loaders = ver.loaders;
        detail.gameVersions = ver.game_versions;
        detail.changelog = ver.changelog;
        project = await modrinthClient.getProject(ver.project_id);
      }
    }

    if (project) {
      detail.title = project.title;
      detail.slug = project.slug;
      detail.projectId = project.id;
      detail.projectType = project.project_type ?? "mod";
      detail.author = project.author || project.team || "-";
      detail.description = project.description;
      detail.body = project.body;
      detail.downloads = project.downloads;
      detail.followers = project.followers;
      detail.categories = project.categories;
      detail.clientSide = project.client_side;
      detail.serverSide = project.server_side;
      detail.license = project.license?.name || project.license?.id;
      detail.webUrl = `https://modrinth.com/${project.project_type ?? "mod"}/${project.slug}`;
      detail.sourceUrl = project.source_url;
      detail.issuesUrl = project.issues_url;
      detail.wikiUrl = project.wiki_url;
      detail.discordUrl = project.discord_url;

      try {
        const versions = await modrinthClient.getProjectVersions(project.id);
        detail.allVersions = versions;
        if (versions.length > 0) {
          detail.latestVersion = versions[0].version_number;

          await instanceConfig.load();
          const currentInst = instanceConfig.getActiveInstance() ?? activeInstance;
          const userLoader = currentInst?.loader || "fabric";
          const userGameVer = currentInst?.gameVersion || "1.21.1";
          detail.compatibility = computeModCompatibility(versions, userLoader, userGameVer);

          const currentVerObj =
            versions.find(
              (v) =>
                v.version_number === detail.installedVersion ||
                (detail.sha1 && v.files.some((f) => f.hashes.sha1 === detail.sha1)),
            ) ?? versions[0];

          if (currentVerObj) {
            detail.changelog = currentVerObj.changelog;
            if (!detail.installedVersion) {
              detail.installedVersion = currentVerObj.version_number;
              detail.versionNumber = currentVerObj.version_number;
            }
          }
        }
      } catch {}
    }
  } catch {}

  return detail;
}

export async function buildRemoteModDetail(
  slugOrId: string,
  userLoader: string,
  userGameVersion: string,
): Promise<{detail: ComprehensiveModDetail; project: ModProject; versions: ModVersion[]}> {
  const [project, versions] = await Promise.all([
    modrinthClient.getProject(slugOrId),
    modrinthClient.getProjectVersions(slugOrId),
  ]);

  const compatibility = computeModCompatibility(versions, userLoader, userGameVersion);
  const bestVer = compatibility.bestCompatibleVersion ?? versions[0];
  const primaryFile = bestVer?.files?.find((f) => f.primary) ?? bestVer?.files?.[0];
  const requiredLibs = await getRequiredDependencyTitles(bestVer, project);

  const detail: ComprehensiveModDetail = {
    title: project.title,
    slug: project.slug,
    projectId: project.id,
    projectType: project.project_type ?? "mod",
    status: "not_installed",
    isInstalled: false,
    author: project.author || project.team || "-",
    description: project.description,
    body: project.body,
    changelog: bestVer?.changelog,
    allVersions: versions,
    dependencies: requiredLibs,
    downloads: project.downloads,
    followers: project.followers,
    categories: project.categories,
    clientSide: project.client_side,
    serverSide: project.server_side,
    license: project.license?.name || project.license?.id,
    webUrl: `https://modrinth.com/${project.project_type ?? "mod"}/${project.slug}`,
    sourceUrl: project.source_url,
    issuesUrl: project.issues_url,
    wikiUrl: project.wiki_url,
    discordUrl: project.discord_url,
    latestVersion: bestVer?.version_number,
    loaders: bestVer?.loaders,
    gameVersions: bestVer?.game_versions,
    fileSizeStr: primaryFile ? formatBytes(primaryFile.size) : undefined,
    sha1: primaryFile?.hashes?.sha1,
    compatibility,
  };

  return {detail, project, versions};
}
