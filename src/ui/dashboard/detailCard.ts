import chalk from "chalk";
import Table from "cli-table3";
import {theme, tableChars} from "../theme.js";
import {formatNumber} from "../../utils/format.js";
import type {ModCompatibilityInfo} from "../../core/minecraft/compatibility.js";
import type {ModVersion} from "../../types/modrinth.js";

export interface ComprehensiveModDetail {
  title: string;
  filename?: string;
  slug?: string;
  projectId?: string;
  projectType: string;
  status: "active" | "disabled" | "not_installed";
  isInstalled: boolean;
  isRoot?: boolean;

  filePath?: string;
  fileSizeBytes?: number;
  fileSizeStr?: string;
  sha1?: string;
  sha512?: string;
  installedAt?: string;
  modifiedAt?: string;

  installedVersion?: string;
  versionNumber?: string;
  latestVersion?: string;
  gameVersions?: string[];
  loaders?: string[];
  clientSide?: string;
  serverSide?: string;
  compatibility?: ModCompatibilityInfo;

  dependencies?: string[];
  dependedBy?: string[];

  author?: string;
  team?: string;
  license?: string;
  downloads?: number;
  followers?: number;
  categories?: string[];

  webUrl?: string;
  sourceUrl?: string;
  issuesUrl?: string;
  wikiUrl?: string;
  discordUrl?: string;

  description?: string;
  body?: string;
  changelog?: string;
  allVersions?: ModVersion[];
}

export function renderComprehensiveModDetailCard(detail: ComprehensiveModDetail): void {
  const termCols = process.stdout.columns || 80;
  const col2Width = Math.max(28, Math.min(62, termCols - 25));
  const metaTable = new Table({
    colWidths: [18, col2Width],
    wordWrap: true,
    chars: tableChars,
    style: {head: [], border: [theme.border]},
  });

  const authorText =
    detail.author && detail.author !== "-" ? chalk.hex(theme.muted)(` by ${detail.author}`) : "";
  const slugText = detail.slug ? chalk.hex(theme.muted)(` [${detail.slug}]`) : "";
  metaTable.push([
    chalk.hex(theme.secondary).bold("Mod / Proyek"),
    chalk.bold.hex(theme.text)(detail.title) + authorText + slugText,
  ]);

  let statusBadge = "";
  if (detail.status === "active") {
    statusBadge = chalk.hex(theme.success).bold("● Aktif");
  } else if (detail.status === "disabled") {
    statusBadge = chalk.hex(theme.error).bold("○ Nonaktif (.disabled)");
  } else {
    statusBadge = chalk.hex(theme.info).bold("🌐 Belum Terpasang (Modrinth)");
  }

  const fileDetail = detail.filename
    ? `  •  ${chalk.hex(theme.primary)(detail.filename)}${detail.fileSizeStr ? chalk.hex(theme.muted)(` (${detail.fileSizeStr})`) : ""}`
    : "";
  metaTable.push([chalk.hex(theme.secondary)("Status Berkas"), statusBadge + fileDetail]);

  if (detail.compatibility) {
    const comp = detail.compatibility;
    if (comp.isCompatible && comp.bestCompatibleVersion) {
      metaTable.push([
        chalk.hex(theme.secondary)("Kesesuaian Target"),
        chalk
          .hex(theme.success)
          .bold(`✔ Cocok [${comp.userLoader.toUpperCase()} ${comp.userGameVersion}]`) +
          chalk.hex(theme.primary)(` → Rilis v${comp.bestCompatibleVersion.version_number}`),
      ]);
    } else {
      const availLdr = comp.availableLoaders.slice(0, 3).join(", ");
      const availVer = comp.availableGameVersions.slice(0, 4).join(", ");
      metaTable.push([
        chalk.hex(theme.secondary)("Kesesuaian Target"),
        chalk
          .hex(theme.error)
          .bold(`✖ Inkompatibel [${comp.userLoader.toUpperCase()} ${comp.userGameVersion}]`) +
          chalk.hex(theme.warning)(` (Tersedia: ${availLdr || "-"} | MC: ${availVer || "-"})`),
      ]);
    }
  }

  if (detail.installedVersion) {
    const isLatest = detail.latestVersion && detail.latestVersion === detail.installedVersion;
    const verStatus = isLatest
      ? chalk.hex(theme.success)(`v${detail.installedVersion} (Terkini)`)
      : detail.latestVersion
        ? chalk.hex(theme.warning)(
            `v${detail.installedVersion} → Update: v${detail.latestVersion}!`,
          )
        : `v${detail.installedVersion}`;
    metaTable.push([chalk.hex(theme.secondary)("Versi Terpasang"), verStatus]);
  } else if (detail.latestVersion) {
    metaTable.push([
      chalk.hex(theme.secondary)("Rilis Terkini"),
      chalk.hex(theme.text).bold(`v${detail.latestVersion}`),
    ]);
  }

  if (detail.dependencies && detail.dependencies.length > 0) {
    const depStr = detail.dependencies.map((d) => chalk.hex(theme.warning)(d)).join(", ");
    const noteStr = detail.isInstalled
      ? ""
      : chalk.hex(theme.textMuted)(" (Auto-install saat unduh)");
    metaTable.push([chalk.hex(theme.secondary)("Library Wajib"), depStr + noteStr]);
  } else if (!detail.isInstalled) {
    metaTable.push([
      chalk.hex(theme.secondary)("Library Wajib"),
      chalk.hex(theme.success)("Tidak ada (Mod Mandiri)"),
    ]);
  }

  if (detail.downloads !== undefined || detail.followers !== undefined) {
    const statsStr =
      chalk.hex(theme.textMuted)(`⬇ ${formatNumber(detail.downloads ?? 0)} unduhan`) +
      chalk.hex(theme.muted)("  •  ") +
      chalk.hex(theme.textMuted)(`⭐ ${formatNumber(detail.followers ?? 0)} pengikut`) +
      (detail.license ? chalk.hex(theme.muted)(`  •  ${detail.license}`) : "");
    metaTable.push([chalk.hex(theme.secondary)("Statistik"), statsStr]);
  }

  if (detail.description) {
    metaTable.push([
      chalk.hex(theme.secondary)("Deskripsi"),
      chalk.hex(theme.textMuted)(
        detail.description.slice(0, 160) + (detail.description.length > 160 ? "..." : ""),
      ),
    ]);
  }

  console.log(metaTable.toString());
}
