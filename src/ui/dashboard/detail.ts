import path from "node:path";
import {rm} from "node:fs/promises";
import chalk from "chalk";
import {showBanner, clearScreen, logger, theme} from "../theme.js";
import {
  askInteractiveMenu,
  ask,
  type InteractiveChoice,
} from "../interactive.js";
import {updateCommand} from "../../commands/update.js";
import {installCommand} from "../../commands/install.js";
import {DependencyGraph} from "../../core/dependency/graph.js";
import {toggleModFile} from "../../core/instance/modToggle.js";
import {formatBytes, formatNumber} from "../../utils/format.js";
import {modrinthClient} from "../../api/client.js";
import {p, pc} from "../prompts.js";
import {displayPaginatedMarkdown} from "../markdownViewer.js";
import {instanceConfig} from "../../core/instance/config.js";
import {profileSnapshotManager} from "../../core/profile/snapshotManager.js";
import {
  isMinecraftVersionAtLeast1_16,
  compareMinecraftVersionsDesc,
  getMinecraftReleaseVersions,
} from "../../core/minecraft/versions.js";
import {
  computeModCompatibility,
  type ModCompatibilityInfo,
} from "../../core/minecraft/compatibility.js";
import {renderComprehensiveModDetailCard, type ComprehensiveModDetail} from "./detailCard.js";
import {handleVersionsExplorer} from "./versionsExplorer.js";
import {
  ensureInstanceEnvironment,
  buildInstalledModDetail,
  buildRemoteModDetail,
} from "./detailLoader.js";
import type {SavedInstanceConfig} from "../../types/instance.js";
import type {ProjectType, ModProject, ModVersion} from "../../types/modrinth.js";

export {
  computeModCompatibility,
  type ModCompatibilityInfo,
  renderComprehensiveModDetailCard,
  type ComprehensiveModDetail,
  ensureInstanceEnvironment,
  buildInstalledModDetail,
  buildRemoteModDetail,
};

export async function runInstalledModDetailRoute(
  initialFilename: string,
  activeInstance: SavedInstanceConfig | undefined,
  modsDir: string,
): Promise<void> {
  let currentFilename = initialFilename;
  let viewingDetails = true;
  const instanceDir = activeInstance?.rootDir ?? path.dirname(modsDir);

  while (viewingDetails) {
    await instanceConfig.load();
    const currentInst = instanceConfig.getActiveInstance() ?? activeInstance;

    clearScreen();
    logger.muted(`  Memuat rincian detail mod untuk "${currentFilename}"...`);

    const detail = await buildInstalledModDetail(
      currentFilename,
      modsDir,
      instanceDir,
      currentInst,
    );

    const actionChoices: InteractiveChoice[] = [
      {
        name: "📖  1. Baca Deskripsi Lengkap Mod (Modrinth Body)",
        value: "view_body",
        hint: detail.body
          ? `${detail.body.length} karakter dokumentasi`
          : "Buka deskripsi Markdown",
      },
      {
        name: "📝  2. Catatan Rilis & Changelog",
        value: "view_changelog",
        hint: detail.installedVersion
          ? `Changelog v${detail.installedVersion}`
          : "Patch notes rilis",
      },
      {
        name: "📋  3. Riwayat Seluruh Versi (Versions Explorer)",
        value: "versions",
        hint: detail.allVersions?.length
          ? `${detail.allVersions.length} versi Modrinth`
          : "Daftar rilis lengkap",
      },
      {
        name:
          detail.status === "active"
            ? "🔴  4. Nonaktifkan Mod Ini (.jar -> .jar.disabled)"
            : "🟢  4. Aktifkan Mod Ini (.jar.disabled -> .jar)",
        value: "toggle",
        hint: "Ubah status berkas secara instan tanpa unduh ulang",
      },
      {
        name: "🔄  5. Periksa & Unduh Pembaruan Mod",
        value: "update_single",
        hint:
          detail.latestVersion && detail.latestVersion !== detail.installedVersion
            ? `Versi baru: ${detail.latestVersion}!`
            : "Cari rilis terbaru",
      },
      {
        name: "🌐  6. Tautan Web & Media Sosial Modrinth",
        value: "open_web",
        hint: detail.webUrl ?? "Halaman resmi Modrinth",
      },
      {
        name: "🩺  7. Verifikasi Integritas Berkas (SHA-1 Checksum)",
        value: "verify_hash",
        hint: "Verifikasi kecocokan hash berkas lokal dengan Modrinth",
      },
      {
        name: "🗑️   8. Hapus Mod Ini Permanen",
        value: "remove",
        hint: "Hapus berkas fisik & bersihkan dependensi yatim",
      },
      {name: "──────────────────", value: "sep"},
      {name: "[Kembali ke Daftar Mod]", value: "back"},
    ];

    const action = await askInteractiveMenu(
      `DETAIL LENGKAP & PILIH AKSI: "${detail.title.toUpperCase()}"`,
      actionChoices,
      () => {
        showBanner(currentInst?.name, true);
        renderComprehensiveModDetailCard(detail);
      },
    );

    if (!action || action === "back" || action === "sep") {
      viewingDetails = false;
      break;
    }

    switch (action) {
      case "view_body": {
        const bodyContent =
          detail.body || detail.description || "Tidak ada deskripsi lengkap dari pembuat mod.";
        await displayPaginatedMarkdown(`${detail.title} - Deskripsi Lengkap`, bodyContent);
        break;
      }

      case "view_changelog": {
        const changelogContent =
          detail.changelog ||
          "Penulis mod tidak menyertakan catatan rilis (changelog) untuk versi ini.";
        const verTitle = detail.installedVersion ? `v${detail.installedVersion}` : "Terkini";
        await displayPaginatedMarkdown(
          `${detail.title} - Catatan Rilis (${verTitle})`,
          changelogContent,
        );
        break;
      }

      case "versions": {
        const didInstall = await handleVersionsExplorer(detail, currentInst, modsDir, true);
        if (didInstall) {
          await ask("Tekan Enter untuk memuat ulang rute detail...");
        }
        break;
      }

      case "toggle": {
        clearScreen();
        showBanner(currentInst?.name, true);
        const willEnable = detail.status === "disabled";
        try {
          const newName = await toggleModFile(modsDir, currentFilename, willEnable);
          currentFilename = newName;
          p.log.success(
            willEnable
              ? pc.green(`Mod diaktifkan: ${pc.bold(newName)}`)
              : pc.yellow(`Mod dinonaktifkan: ${pc.bold(newName)}`),
          );
        } catch (err: any) {
          p.log.error(`Gagal mengubah status mod: ${err.message}`);
        }
        await ask("Tekan Enter untuk kembali ke detail mod...");
        break;
      }

      case "update_single": {
        clearScreen();
        showBanner(currentInst?.name, true);
        try {
          await updateCommand({
            dir: modsDir,
            mcVersion: currentInst?.gameVersion,
            loader: currentInst?.loader,
            targetFile: currentFilename.endsWith(".disabled") ? undefined : currentFilename,
            skipBanner: true,
          });
        } catch (err: any) {
          p.log.error(`Pembaruan gagal: ${err.message}`);
        }
        await ask("Tekan Enter untuk kembali ke detail mod...");
        break;
      }

      case "open_web": {
        clearScreen();
        showBanner(currentInst?.name, true);
        p.note(
          `Mod          : ${pc.bold(detail.title)}\n` +
            `Slug / ID    : ${pc.cyan(detail.slug ?? "-")} (${detail.projectId ?? "-"})\n` +
            `Penulis      : ${pc.dim(detail.author || "-")}\n` +
            `Lisensi      : ${pc.dim(detail.license || "-")}\n` +
            `Halaman Web  : ${pc.cyan(pc.underline(detail.webUrl || "-"))}\n` +
            `Kode Sumber  : ${pc.dim(detail.sourceUrl || "-")}\n` +
            `Pelacak Bug  : ${pc.dim(detail.issuesUrl || "-")}\n` +
            `Wiki Dokumen : ${pc.dim(detail.wikiUrl || "-")}\n` +
            `Komunitas    : ${pc.dim(detail.discordUrl || "-")}\n` +
            `Total Unduh  : ${detail.downloads ? pc.green(formatNumber(detail.downloads)) : "-"}`,
          "Informasi Web & Eksternal Mod",
        );
        await ask("Tekan Enter untuk kembali ke detail mod...");
        break;
      }

      case "verify_hash": {
        clearScreen();
        showBanner(currentInst?.name, true);
        const s = p.spinner();
        s.start(`Memverifikasi integritas berkas ${currentFilename}...`);
        try {
          if (detail.sha1) {
            const versionMap = await modrinthClient.getVersionsByHashes([detail.sha1]);
            const matched = versionMap[detail.sha1];
            if (matched) {
              s.stop(pc.green("Verifikasi Integritas Berhasil!"));
              p.note(
                `Status       : ${pc.green("✔ Cocok 100% dengan rilis resmi Modrinth")}\n` +
                  `Nama Rilis   : ${matched.name}\n` +
                  `Versi Rilis  : ${matched.version_number}\n` +
                  `Tipe Rilis   : ${matched.version_type.toUpperCase()}\n` +
                  `SHA-1 Hash   : ${pc.dim(detail.sha1)}`,
                "Hasil Pemeriksaan Checksum",
              );
            } else {
              s.stop(pc.yellow("Berkas tidak terdaftar di database publik Modrinth."));
              p.log.warn(
                "Berkas ini kemungkinan diunduh manual, dikompilasi sendiri, atau mod kustom.",
              );
            }
          } else {
            s.stop(pc.red("Gagal menghitung hash berkas."));
          }
        } catch (err: any) {
          s.stop(pc.red("Gagal menghubungi Modrinth API."));
          p.log.error(err.message);
        }
        await ask("Tekan Enter untuk kembali ke detail mod...");
        break;
      }

      case "remove": {
        clearScreen();
        showBanner(currentInst?.name, true);
        const confirm = await askInteractiveMenu(
          `Apakah Anda yakin ingin menghapus berkas "${currentFilename}" secara permanen?`,
          [
            {name: "🗑️  Ya, hapus berkas ini", value: "yes"},
            {name: "Batal", value: "no"},
          ],
        );
        if (confirm === "yes") {
          const s = p.spinner();
          s.start(`Menghapus ${currentFilename}...`);
          try {
            await rm(path.join(modsDir, currentFilename), {force: true});
            const graph = new DependencyGraph(instanceDir);
            await graph.load();
            const {orphanedSlugs} = graph.removeMod(currentFilename);
            await graph.save();
            s.stop(pc.green(`Berkas ${currentFilename} berhasil dihapus.`));
            if (orphanedSlugs.length > 0) {
              p.log.warn(
                `Dependensi yatim terdeteksi (tidak lagi digunakan): ${pc.yellow(orphanedSlugs.join(", "))}`,
              );
            }
            viewingDetails = false;
            await ask("Tekan Enter untuk kembali ke daftar mod...");
            break;
          } catch (err: any) {
            s.stop(pc.red(`Gagal menghapus berkas: ${err.message}`));
            await ask("Tekan Enter untuk kembali ke detail mod...");
          }
        }
        break;
      }
    }
  }
}

async function handleQuickSwitchForMod(
  detail: ComprehensiveModDetail,
  currentInstance: SavedInstanceConfig | undefined,
): Promise<boolean> {
  const comp = detail.compatibility;
  if (!comp || !currentInstance) return false;

  await instanceConfig.load();
  const cfg = instanceConfig.get();
  const activeKey = cfg.activeInstance;
  if (!activeKey) {
    p.log.error("Tidak ada instance Minecraft aktif.");
    await ask("Tekan Enter untuk kembali...");
    return false;
  }

  const loaders =
    comp.availableLoaders.length > 0
      ? comp.availableLoaders
      : ["fabric", "quilt", "forge", "neoforge"];
  const rawVersions = comp.availableGameVersions
    .filter(isMinecraftVersionAtLeast1_16)
    .sort(compareMinecraftVersionsDesc);
  const gameVersions = rawVersions.length > 0 ? rawVersions : await getMinecraftReleaseVersions();

  const loaderChoices: InteractiveChoice[] = loaders.map((ldr) => ({
    name: `${ldr.toUpperCase()}${ldr === currentInstance.loader ? " (Aktif Saat Ini)" : ""}`,
    value: ldr,
  }));
  loaderChoices.push({name: "──────────────────", value: "sep"});
  loaderChoices.push({name: "[Batal]", value: "cancel"});

  const chosenLoader = await askInteractiveMenu(
    `Pilih Loader Minecraft untuk "${detail.title}":`,
    loaderChoices,
    () => showBanner(currentInstance.name, true),
  );
  if (!chosenLoader || chosenLoader === "cancel" || chosenLoader === "sep") return false;

  const verChoices: InteractiveChoice[] = gameVersions.map((gv: string) => {
    const isCurrent = gv === currentInstance.gameVersion;
    return {
      name: `${isCurrent ? "● " : "○ "}Minecraft ${gv}`,
      value: gv,
      hint: isCurrent ? "Aktif Saat Ini" : undefined,
    };
  });
  verChoices.push({name: "──────────────────", value: "sep"});
  verChoices.push({name: "[Batal]", value: "cancel"});

  const chosenVer = await askInteractiveMenu(
    `Pilih Versi Minecraft untuk "${detail.title}":`,
    verChoices,
    () => showBanner(currentInstance.name, true),
  );
  if (!chosenVer || chosenVer === "cancel" || chosenVer === "sep") return false;

  const s = p.spinner();
  s.start(`Beralih profil ke ${chosenLoader} ${chosenVer} (Auto-Snapshot mod lama)...`);
  try {
    const res = await profileSnapshotManager.switchProfile(activeKey, chosenLoader, chosenVer);
    await instanceConfig.load();
    s.stop(pc.green(`Berhasil beralih ke ${chosenLoader} ${chosenVer}!`));
    p.note(
      `Profil Aktif : ${chosenLoader} ${chosenVer}\nMod Pulih    : ${res.restoredCount} mod dikembalikan ke folder mods`,
      "Beralih Profil Sukses",
    );
    await ask("Tekan Enter untuk memuat rute detail dengan versi baru...");
    return true;
  } catch (err: any) {
    s.stop(pc.red("Gagal beralih profil!"));
    p.log.error(err.message || "Kesalahan sistem.");
    await ask("Tekan Enter untuk kembali...");
    return false;
  }
}

export async function runRemoteModDetailRoute(
  slugOrId: string,
  activeInstance: SavedInstanceConfig | undefined,
  projectType: ProjectType = "mod",
): Promise<void> {
  let onDetail = true;
  while (onDetail) {
    await instanceConfig.load();
    const currentInstance = instanceConfig.getActiveInstance() ?? activeInstance;
    const {loader: userLoader, gameVersion: userGameVersion} =
      await ensureInstanceEnvironment(currentInstance);
    const modsDir = currentInstance?.modsDir || "";

    clearScreen();
    logger.muted(
      `  Memeriksa kecocokan versi untuk "${slugOrId}" dengan [${userLoader.toUpperCase()} ${userGameVersion}]...`,
    );

    const {detail, versions} = await buildRemoteModDetail(slugOrId, userLoader, userGameVersion);
    const comp = detail.compatibility!;
    const isComp = comp.isCompatible && comp.bestCompatibleVersion;

    const detailChoices: InteractiveChoice[] = [
      {
        name: "📖  1. Baca Deskripsi Lengkap Mod (Modrinth Body)",
        value: "view_body",
        hint: detail.body
          ? `${detail.body.length} karakter dokumentasi`
          : "Buka deskripsi Markdown",
      },
      {
        name: "📝  2. Catatan Rilis & Changelog",
        value: "view_changelog",
        hint: isComp
          ? `Changelog v${comp.bestCompatibleVersion!.version_number}`
          : "Catatan rilis versi terbaru",
      },
    ];

    if (isComp) {
      const libCount = detail.dependencies?.length ?? 0;
      const libHint = libCount > 0 ? ` + ${libCount} library otomatis` : " (Mod mandiri)";
      detailChoices.push({
        name: `⬇  3. Unduh & Pasang Versi Terbaru (v${comp.bestCompatibleVersion!.version_number})`,
        value: "install_compatible",
        hint: `✔ Cocok untuk ${userLoader.toUpperCase()} ${userGameVersion}${libHint}`,
      });
    } else {
      detailChoices.push({
        name: `⚠️  3. Mod Inkompatibel (Pilih Solusi / Beralih Versi yang Didukung)`,
        value: "incompatible_warning",
        hint: `Tersedia untuk: ${comp.availableLoaders.slice(0, 3).join(", ") || "-"}`,
      });
    }

    detailChoices.push(
      {
        name: `📋  4. Riwayat Seluruh Versi (${isComp ? `${comp.compatibleVersionCount} cocok / ` : ""}${versions.length} total)`,
        value: "list_versions",
        hint: "Jelajahi dan pilih versi tertentu",
      },
      {
        name: "🌐  5. Informasi Web & Tautan Eksternal",
        value: "open_web",
        hint: detail.webUrl ?? "Halaman resmi Modrinth",
      },
      {name: "──────────────────", value: "sep"},
      {name: "[Kembali ke Hasil Pencarian]", value: "back"},
    );

    const action = await askInteractiveMenu(
      `DETAIL LENGKAP & AKSI: "${detail.title.toUpperCase()}"`,
      detailChoices,
      () => {
        showBanner(currentInstance?.name, true);
        renderComprehensiveModDetailCard(detail);
      },
    );

    if (!action || action === "back" || action === "sep") {
      onDetail = false;
      break;
    }

    if (action === "view_body") {
      const bodyContent =
        detail.body || detail.description || "Tidak ada deskripsi lengkap dari pembuat mod.";
      await displayPaginatedMarkdown(`${detail.title} - Deskripsi Lengkap`, bodyContent);
    } else if (action === "view_changelog") {
      const changelogVer = isComp ? comp.bestCompatibleVersion! : versions[0];
      const changelogContent =
        changelogVer?.changelog ||
        "Penulis mod tidak menyertakan catatan rilis (changelog) untuk versi ini.";
      await displayPaginatedMarkdown(
        `${detail.title} - Catatan Rilis (${changelogVer?.version_number ?? "Terkini"})`,
        changelogContent,
      );
    } else if (action === "install_compatible") {
      clearScreen();
      showBanner(currentInstance?.name, true);
      p.log.info(
        pc.green(
          `Memasang versi yang cocok: ${pc.bold(comp.bestCompatibleVersion!.version_number)} untuk Minecraft ${userGameVersion} (${userLoader})`,
        ),
      );
      try {
        await installCommand([slugOrId], {
          type: projectType,
          mcVersion: userGameVersion,
          loader: userLoader,
          versionId: comp.bestCompatibleVersion!.id,
          dir: currentInstance?.modsDir,
          skipBanner: true,
        });
      } catch (err: any) {
        p.log.error(`Pemasangan gagal: ${err.message}`);
      }
      await ask("Tekan Enter untuk melanjutkan...");
      onDetail = false;
      break;
    } else if (action === "incompatible_warning") {
      clearScreen();
      showBanner(currentInstance?.name, true);
      p.note(
        `Instance Anda      : ${pc.bold(pc.red(`${userLoader.toUpperCase()} ${userGameVersion}`))}\n` +
          `Status Kompatibel  : ${pc.red("Tidak ditemukan rilis yang mendukung kombinasi ini!")}\n\n` +
          `Mod Loader Didukung: ${pc.cyan(comp.availableLoaders.join(", ") || "-")}\n` +
          `Minecraft Didukung : ${pc.yellow(comp.availableGameVersions.slice(0, 8).join(", ") || "-")}\n\n` +
          `${pc.dim("Peringatan: Memasang mod yang tidak sesuai dapat menyebabkan Minecraft crash saat diluncurkan.")}`,
        "PERINGATAN INKOMPATIBILITAS MOD",
      );

      const incompChoices: InteractiveChoice[] = [
        {
          name: "🔄  1. Beralih ke Versi / Loader yang Didukung Mod Ini",
          value: "switch_to_mod_ver",
          hint: "Ganti profil game ke salah satu kombinasi yang didukung mod ini",
        },
        {
          name: "📋  2. Pilih Manual Versi Rilis Lain dari Daftar",
          value: "choose_manual",
          hint: "Lihat daftar seluruh rilis Modrinth",
        },
        {name: "──────────────────", value: "sep"},
        {name: "[Batalkan]", value: "cancel"},
      ];

      const userChoice = await askInteractiveMenu(
        "OPSI PENYELESAIAN INKOMPATIBILITAS:",
        incompChoices,
        () => showBanner(currentInstance?.name, true),
      );

      if (userChoice === "switch_to_mod_ver") {
        const switched = await handleQuickSwitchForMod(detail, currentInstance);
        if (switched) {
          continue;
        }
      } else if (userChoice === "choose_manual") {
        const didInstall = await handleVersionsExplorer(detail, currentInstance, modsDir, false);
        if (didInstall) {
          onDetail = false;
          break;
        }
      }
    } else if (action === "list_versions") {
      const didInstall = await handleVersionsExplorer(detail, currentInstance, modsDir, false);
      if (didInstall) {
        onDetail = false;
        break;
      }
    } else if (action === "open_web") {
      clearScreen();
      showBanner(currentInstance?.name, true);
      p.note(
        `Mod          : ${pc.bold(detail.title)}\n` +
          `Slug / ID    : ${pc.cyan(detail.slug ?? "-")} (${detail.projectId ?? "-"})\n` +
          `Penulis      : ${pc.dim(detail.author || "-")}\n` +
          `Lisensi      : ${pc.dim(detail.license || "-")}\n` +
          `Halaman Web  : ${pc.cyan(pc.underline(detail.webUrl || "-"))}\n` +
          `Kode Sumber  : ${pc.dim(detail.sourceUrl || "-")}\n` +
          `Pelacak Bug  : ${pc.dim(detail.issuesUrl || "-")}\n` +
          `Wiki Dokumen : ${pc.dim(detail.wikiUrl || "-")}\n` +
          `Komunitas    : ${pc.dim(detail.discordUrl || "-")}\n` +
          `Total Unduh  : ${detail.downloads ? pc.green(formatNumber(detail.downloads)) : "-"}`,
        "Informasi Web & Eksternal Mod",
      );
      await ask("Tekan Enter untuk kembali ke detail mod...");
    }
  }
}
