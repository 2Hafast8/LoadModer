import chalk from "chalk";
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
  const userGameVer = currentInst?.gameVersion || "1.21.1";

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
        name: `🔍  [Filter: Hanya ${userLoader.toUpperCase()} ${userGameVer}] (Klik untuk lihat SEMUA)`,
        value: "__toggle_filter__",
        hint: `${displayedVersions.length} dari ${versions.length} versi cocok`,
      });
    } else {
      versionChoices.push({
        name: `🔍  [Filter: Menampilkan SEMUA Versi] (Klik untuk filter ${userLoader.toUpperCase()} ${userGameVer})`,
        value: "__toggle_filter__",
        hint: `Total ${versions.length} rilis`,
      });
    }

    if (displayedVersions.length === 0) {
      versionChoices.push({
        name: chalk.hex(theme.error)(
          `✖ Tidak ada versi yang cocok untuk ${userLoader} ${userGameVer}`,
        ),
        value: "none",
        hint: "Klik filter di atas untuk melihat versi versi Minecraft lain",
      });
    } else {
      for (const v of displayedVersions.slice(0, 25)) {
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
          hint: `⬇ ${formatNumber(v.downloads)}  •  Rilis: ${v.date_published.split("T")[0]}`,
          badge: allBadges,
        });
      }
    }

    versionChoices.push({name: "──────────────────", value: "sep"});
    versionChoices.push({name: "[Kembali ke Detail Mod]", value: "back"});

    const pickedVerId = await askInteractiveMenu(
      `RIWAYAT VERSI "${detail.title.toUpperCase()}" (${displayedVersions.length} DITAMPILKAN)`,
      versionChoices,
      () => showBanner(currentInst?.name, true),
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
        name: "📝  1. Baca Catatan Rilis / Changelog Versi Ini",
        value: "view_changelog",
        hint: selectedVer.changelog
          ? "Tampilkan perubahan & perbaikan bug"
          : "(Tidak ada changelog)",
      },
      {
        name: `⬇  2. ${isInstalledMode ? "Ganti / Pasang Versi Ini (Switch/Rollback)" : "Pasang Versi Ini ke Instance"}`,
        value: "install",
        hint: `${selectedVer.version_number} (${selectedVer.loaders?.join(", ") ?? ""}) ${isMatched ? "✔ Cocok" : "⚠️ Beda Versi"}`,
      },
      {name: "──────────────────", value: "sep"},
      {name: "[Kembali ke Daftar Versi]", value: "back"},
    ];

    const verAction = await askInteractiveMenu(
      `DETAIL VERSI: ${selectedVer.name || selectedVer.version_number} [${selectedVer.version_type.toUpperCase()}]`,
      subChoices,
      () => {
        showBanner(currentInst?.name, true);
        const matchNote = isMatched
          ? chalk
              .hex(theme.success)
              .bold(`✔ Cocok dengan instance Anda (${userLoader} ${userGameVer})`)
          : chalk
              .hex(theme.warning)
              .bold(`⚠️ Tidak cocok dengan instance Anda (${userLoader} ${userGameVer})`);

        p.note(
          `Versi        : ${pc.bold(selectedVer.version_number)} (${selectedVer.version_type})\n` +
            `Kesesuaian   : ${matchNote}\n` +
            `Nama Rilis   : ${pc.cyan(selectedVer.name || "-")}\n` +
            `Tanggal Rilis: ${pc.dim(new Date(selectedVer.date_published).toLocaleDateString())}\n` +
            `Mod Loader   : ${chalk.hex(theme.primary).bold(selectedVer.loaders?.join(", ") || "-")}\n` +
            `Minecraft    : ${pc.dim(selectedVer.game_versions?.join(", ") || "-")}\n` +
            `Unduhan      : ${pc.green(formatNumber(selectedVer.downloads))}\n` +
            `Berkas       : ${primaryFile ? `${primaryFile.filename} (${formatBytes(primaryFile.size)})` : "-"}\n` +
            `SHA-1        : ${pc.dim(primaryFile?.hashes?.sha1 || "-")}`,
          `Informasi Versi ${selectedVer.version_number}`,
        );
      },
    );

    if (verAction === "view_changelog") {
      await displayPaginatedMarkdown(
        `${detail.title} - Changelog (${selectedVer.version_number})`,
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
