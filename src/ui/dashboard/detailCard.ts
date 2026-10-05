import chalk from "chalk";
import boxen from "boxen";
import {theme} from "../theme.js";
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
  const cardTitle =
    chalk.hex(theme.primary).bold(` ❖ ${detail.title.toUpperCase()} `) +
    (detail.slug ? chalk.hex(theme.muted)(`[${detail.slug}] `) : "");

  let statusBadge = "";
  if (detail.isInstalled || detail.status === "active" || detail.status === "disabled") {
    if (detail.status === "disabled") {
      statusBadge = chalk.hex(theme.warning).bold("○ Terpasang (Nonaktif)");
    } else {
      statusBadge = chalk.hex(theme.success).bold("✔ Terpasang (Aktif)");
    }
  } else {
    statusBadge = chalk.hex(theme.info).bold("🌐 Belum Terpasang (Modrinth)");
  }

  const verText = detail.installedVersion
    ? chalk.hex(theme.success)(`v${detail.installedVersion}`) +
      (detail.latestVersion && detail.latestVersion !== detail.installedVersion
        ? chalk.hex(theme.warning)(` (Pembaruan: v${detail.latestVersion})`)
        : " (Terkini)")
    : detail.latestVersion
      ? chalk.hex(theme.textMuted)(`Rilis Terkini: v${detail.latestVersion}`)
      : "";

  const line1 =
    chalk.hex(theme.textMuted)("Status    : ") +
    statusBadge +
    (verText ? "   •   " + chalk.hex(theme.textMuted)("Versi : ") + verText : "") +
    (detail.fileSizeStr ? "   •   " + chalk.hex(theme.textMuted)("Ukuran : ") + chalk.hex(theme.info)(detail.fileSizeStr) : "");

  let line2 = "";
  if (detail.compatibility) {
    const comp = detail.compatibility;
    if (comp.isCompatible && comp.bestCompatibleVersion) {
      line2 =
        chalk.hex(theme.textMuted)("Kesesuaian: ") +
        chalk.hex(theme.success).bold(`✔ Cocok [${comp.userLoader.toUpperCase()} ${comp.userGameVersion}]`) +
        chalk.hex(theme.primary)(` → Rilis v${comp.bestCompatibleVersion.version_number}`);
    } else {
      const availLdr = comp.availableLoaders.slice(0, 3).join(", ");
      const availVer = comp.availableGameVersions.slice(0, 3).join(", ");
      line2 =
        chalk.hex(theme.textMuted)("Kesesuaian: ") +
        chalk.hex(theme.error).bold(`✖ Inkompatibel [${comp.userLoader.toUpperCase()} ${comp.userGameVersion}]`) +
        chalk.hex(theme.warning)(` (Tersedia: ${availLdr || "-"} | MC: ${availVer || "-"})`);
    }
  }

  const downloadsStr = detail.downloads !== undefined ? `⬇ ${formatNumber(detail.downloads)} unduhan` : "";
  const followersStr = detail.followers !== undefined ? `⭐ ${formatNumber(detail.followers)} pengikut` : "";
  const licenseStr = detail.license ? `Lisensi: ${detail.license}` : "";
  const statsParts = [downloadsStr, followersStr, licenseStr].filter(Boolean);
  const lineStats = statsParts.length > 0
    ? chalk.hex(theme.textMuted)("Statistik : ") + chalk.hex(theme.muted)(statsParts.join("   •   "))
    : "";

  let lineDep = "";
  if (detail.dependencies && detail.dependencies.length > 0) {
    const depStr = detail.dependencies.map((d) => chalk.hex(theme.warning)(d)).join(", ");
    const noteStr = detail.isInstalled ? "" : chalk.hex(theme.textMuted)(" (Auto-install)");
    lineDep = chalk.hex(theme.textMuted)("Library   : ") + depStr + noteStr;
  } else if (!detail.isInstalled) {
    lineDep = chalk.hex(theme.textMuted)("Library   : ") + chalk.hex(theme.success)("Tidak ada (Mod Mandiri)");
  }

  let lineDesc = "";
  if (detail.description) {
    const cleanDesc = detail.description.trim().replace(/\r?\n/g, " ");
    const truncated = cleanDesc.length > 140 ? cleanDesc.slice(0, 140) + "..." : cleanDesc;
    lineDesc = chalk.hex(theme.textMuted)("Deskripsi : ") + chalk.hex(theme.text)(truncated);
  }

  const lines = [line1, line2, lineStats, lineDep, lineDesc].filter(Boolean);

  console.log(
    boxen(lines.join("\n"), {
      padding: { top: 0, bottom: 0, left: 2, right: 2 },
      margin: { top: 0, bottom: 1, left: 0, right: 0 },
      borderStyle: "round",
      borderColor: theme.border,
      title: cardTitle,
      titleAlignment: "left",
    }),
  );
}
