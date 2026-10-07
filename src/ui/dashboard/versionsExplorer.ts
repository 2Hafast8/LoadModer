import path from "node:path";
import chalk from "chalk";
import boxen from "boxen";
import {modrinthClient} from "../../api/client.js";
import {instanceConfig} from "../../core/instance/config.js";
import {installCommand} from "../../commands/install.js";
import {formatNumber, formatBytes} from "../../utils/format.js";
import {displayPaginatedMarkdown} from "../markdownViewer.js";
import {theme, showBanner, clearScreen, logger, formatBadge} from "../theme.js";
import {askInteractiveMenu, ask, type InteractiveChoice} from "../interactive.js";
import {p, pc} from "../prompts.js";
import type {SavedInstanceConfig} from "../../types/instance.js";
import type {ComprehensiveModDetail} from "./detailCard.js";

export async function handleVersionsExplorer(
  detail: ComprehensiveModDetail,
  activeInstance: SavedInstanceConfig | undefined,
  modsDir: string,
  isInstalledMode: boolean,
): Promise<boolean> {
  await instanceConfig.load();
  const currentInst = instanceConfig.getActiveInstance() ?? activeInstance;
  const userLoader = currentInst?.loader || "fabric";
  const userGameVer = currentInst?.gameVersion || "1.20.1";

  const versions =
    detail.allVersions ||
    (await modrinthClient.getProjectVersions(detail.slug || detail.projectId!));

  if (!versions || versions.length === 0) {
    clearScreen();
    showBanner(currentInst?.name, true);
    logger.warn("Tidak ada rilis versi yang ditemukan di Modrinth.");
    await ask("Tekan Enter untuk kembali...");
    return false;
  }

  let filterOnlyCompatible = true;
  let viewingVersions = true;

  while (viewingVersions) {
    const cleanLoader = userLoader.toLowerCase().trim();
    const cleanVer = userGameVer.toLowerCase().trim();

    const displayedVersions = filterOnlyCompatible
      ? versions.filter(
          (v) =>
            v.loaders.some((l) => l.toLowerCase() === cleanLoader) &&
            v.game_versions.some((gv) => gv.toLowerCase() === cleanVer),
        )
      : versions;

    const versionChoices: InteractiveChoice[] = [];

    if (filterOnlyCompatible) {
      versionChoices.push({
        name: `🔎  Filter Kompatibilitas: Hanya ${userLoader.toUpperCase()} ${userGameVer}`,
        value: "__toggle_filter__",
        hint: `Klik untuk melihat seluruh ${versions.length} rilis versi • ${displayedVersions.length} versi cocok`,
        badge: formatBadge("Filter Aktif", "info"),
      });
    } else {
      versionChoices.push({
        name: `🌐  Filter Kompatibilitas: Menampilkan Seluruh Versi`,
        value: "__toggle_filter__",
        hint: `Klik untuk membatasi hanya versi ${userLoader.toUpperCase()} ${userGameVer} • Total ${versions.length} rilis`,
        badge: formatBadge("Semua Versi", "muted"),
      });
    }

    if (displayedVersions.length === 0) {
      versionChoices.push({
        name: chalk.hex(theme.error)(
          `✖ Tidak ada versi yang cocok untuk ${userLoader.toUpperCase()} ${userGameVer}`,
        ),
        value: "none",
        hint: "Klik tombol filter di atas untuk menelusuri versi rilis lainnya",
      });
    } else {
      for (const v of displayedVersions.slice(0, 30)) {
        const releaseBadge =
          v.version_type === "release"
            ? formatBadge("Release", "success")
            : v.version_type === "beta"
              ? formatBadge("Beta", "warning")
              : formatBadge("Alpha", "error");

        const isCurrent = detail.installedVersion && v.version_number === detail.installedVersion;
        const isMatched =
          v.loaders.some((l) => l.toLowerCase() === cleanLoader) &&
          v.game_versions.some((gv) => gv.toLowerCase() === cleanVer);

        const matchBadge = isCurrent
          ? formatBadge("Terpasang", "primary")
          : isMatched
            ? formatBadge("Cocok", "success")
            : undefined;

        const loadersStr = v.loaders?.slice(0, 2).join(", ") ?? "";
        const gvStr = v.game_versions?.slice(0, 2).join(", ") ?? "";

        const allBadges = [releaseBadge, matchBadge].filter(Boolean).join(" ");

        versionChoices.push({
          name: `${v.version_number}  •  ${gvStr} (${loadersStr})`,
          value: v.id,
          hint: `⬇ ${formatNumber(v.downloads)} unduhan • Tanggal: ${v.date_published.split("T")[0]}`,
          badge: allBadges,
        });
      }
    }

    versionChoices.push({name: "──────────────────────────────────────", value: "sep"});
    versionChoices.push({name: "[Kembali ke Detail Mod]", value: "back"});

    const renderListHeader = () => {
      showBanner(currentInst?.name, true);

      const statusBadge = detail.installedVersion
        ? chalk.hex(theme.success).bold(`✔ Terpasang (v${detail.installedVersion})`)
        : chalk.hex(theme.muted)("○ Belum Terpasang");

      const cardContent =
        chalk.hex(theme.textMuted)("Mod Target   : ") +
        chalk.hex(theme.primary).bold(detail.title) +
        "   " +
        chalk.hex(theme.muted)("•") +
        "   " +
        chalk.hex(theme.textMuted)("Status : ") +
        statusBadge +
        "\n" +
        chalk.hex(theme.textMuted)("Instance MC  : ") +
        chalk.hex(theme.secondary).bold(`${userLoader.toUpperCase()} ${userGameVer}`) +
        "   " +
        chalk.hex(theme.muted)("•") +
        "   " +
        chalk.hex(theme.textMuted)("Tampil : ") +
        chalk.hex(theme.info)(`${displayedVersions.length} dari ${versions.length} Rilis Versi`);

      console.log(
        boxen(cardContent, {
          padding: {top: 0, bottom: 0, left: 2, right: 2},
          margin: {top: 0, bottom: 1, left: 0, right: 0},
          borderStyle: "round",
          borderColor: theme.border,
          title: chalk.hex(theme.primary).bold(` ❖ EKSPLORASI VERSI: ${detail.title.toUpperCase()} ❖ `),
          titleAlignment: "left",
        }),
      );
    };

    const pickedVerId = await askInteractiveMenu(
      `RIWAYAT VERSI: ${detail.title.toUpperCase()}`,
      versionChoices,
      renderListHeader,
    );

    if (!pickedVerId || pickedVerId === "back" || pickedVerId === "sep" || pickedVerId === "none") {
      viewingVersions = false;
      break;
    }

    if (pickedVerId === "__toggle_filter__") {
      filterOnlyCompatible = !filterOnlyCompatible;
      continue;
    }

    const selectedVer = versions.find((v) => v.id === pickedVerId);
    if (!selectedVer) continue;

    const primaryFile = selectedVer.files.find((f) => f.primary) ?? selectedVer.files[0];
    const isMatched =
      selectedVer.loaders.some((l) => l.toLowerCase() === cleanLoader) &&
      selectedVer.game_versions.some((gv) => gv.toLowerCase() === cleanVer);

    const subChoices: InteractiveChoice[] = [
      {
        name: "📖  Baca Catatan Rilis (Changelog)",
        value: "view_changelog",
        hint: selectedVer.changelog
          ? "Tampilkan ringkasan pembaruan & perbaikan bug"
          : "Penulis tidak menyertakan catatan rilis",
        badge: formatBadge(selectedVer.changelog ? "Tersedia" : "Kosong", selectedVer.changelog ? "info" : "muted"),
      },
      {
        name: `📥  ${isInstalledMode ? "Ganti / Pasang Versi Ini (Switch/Rollback)" : "Pasang Versi Ini ke Instance"}`,
        value: "install",
        hint: `${selectedVer.version_number} (${selectedVer.loaders?.join(", ") ?? ""}) • ${isMatched ? "Cocok dengan target instance" : "Berbeda loader/versi game"}`,
        badge: formatBadge(isMatched ? "Cocok" : "Perhatian", isMatched ? "success" : "warning"),
      },
      {name: "──────────────────────────────────────", value: "sep"},
      {name: "[Kembali ke Daftar Versi]", value: "back"},
    ];

    const renderVerDetailHeader = () => {
      showBanner(currentInst?.name, true);
      const matchNote = isMatched
        ? chalk.hex(theme.success).bold(`✔ Cocok dengan instance (${userLoader} ${userGameVer})`)
        : chalk.hex(theme.warning).bold(`⚠️ Berbeda dengan instance (${userLoader} ${userGameVer})`);

      const verContent =
        chalk.hex(theme.textMuted)("Nomor Versi  : ") +
        chalk.hex(theme.primary).bold(selectedVer.version_number) +
        "   " +
        chalk.hex(theme.muted)("•") +
        "   " +
        chalk.hex(theme.textMuted)("Tipe : ") +
        chalk.hex(theme.info)(selectedVer.version_type.toUpperCase()) +
        "\n" +
        chalk.hex(theme.textMuted)("Kesesuaian   : ") +
        matchNote +
        "\n" +
        chalk.hex(theme.textMuted)("Mod Loader   : ") +
        chalk.hex(theme.secondary).bold(selectedVer.loaders?.join(", ") || "-") +
        "   " +
        chalk.hex(theme.muted)("•") +
        "   " +
        chalk.hex(theme.textMuted)("Game MC : ") +
        chalk.hex(theme.text)(selectedVer.game_versions?.slice(0, 4).join(", ") || "-") +
        "\n" +
        chalk.hex(theme.textMuted)("Tanggal Rilis: ") +
        chalk.hex(theme.textMuted)(new Date(selectedVer.date_published).toLocaleDateString()) +
        "   " +
        chalk.hex(theme.muted)("•") +
        "   " +
        chalk.hex(theme.textMuted)("Unduhan : ") +
        chalk.hex(theme.success)(`${formatNumber(selectedVer.downloads)} kali`) +
        "\n" +
        chalk.hex(theme.textMuted)("Nama Berkas  : ") +
        chalk.hex(theme.text)(primaryFile ? `${primaryFile.filename} (${formatBytes(primaryFile.size)})` : "-");

      console.log(
        boxen(verContent, {
          padding: {top: 0, bottom: 0, left: 2, right: 2},
          margin: {top: 0, bottom: 1, left: 0, right: 0},
          borderStyle: "round",
          borderColor: theme.border,
          title: chalk.hex(theme.primary).bold(` ❖ RINCIAN RILIS: v${selectedVer.version_number} ❖ `),
          titleAlignment: "left",
        }),
      );
    };

    const verAction = await askInteractiveMenu(
      `RINCIAN RILIS: v${selectedVer.version_number}`,
      subChoices,
      renderVerDetailHeader,
    );

    if (verAction === "view_changelog") {
      await displayPaginatedMarkdown(
        `${detail.title} - Catatan Rilis (v${selectedVer.version_number})`,
        selectedVer.changelog ||
          "Penulis mod tidak menyertakan catatan rilis (changelog) untuk versi ini.",
      );
    } else if (verAction === "install") {
      clearScreen();
      showBanner(currentInst?.name, true);
      const targetSlug = detail.slug || detail.projectId!;
      try {
        await installCommand([targetSlug], {
          mcVersion: userGameVer,
          loader: userLoader,
          versionId: selectedVer.id,
          dir: modsDir,
          skipBanner: true,
        });
      } catch (err: any) {
        p.log.error(`Gagal memasang versi: ${err.message}`);
      }
      await ask("Tekan Enter untuk melanjutkan...");
      return true;
    }
  }

  return false;
}
