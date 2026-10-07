import path from "node:path";
import chalk from "chalk";
import boxen from "boxen";
import {p, pc, showBanner, clearScreen} from "../prompts.js";
import {askInteractiveMenu, ask, type InteractiveChoice} from "../interactive.js";
import {formatBadge, theme} from "../theme.js";
import {instanceConfig} from "../../core/instance/config.js";
import {ModpackProfileManager, type ClientContainerInfo} from "../../core/modpack/profileManager.js";
import {runInteractiveBrowser} from "./browser.js";

export async function runInteractiveModpackProfileManager(): Promise<void> {
  await instanceConfig.load();
  const active = instanceConfig.getActiveInstance();
  if (!active) {
    p.log.error("Tidak ada instance aktif.");
    return;
  }

  const baseDir = active.rootDir ?? path.dirname(active.modsDir);
  let inClientMenu = true;

  while (inClientMenu) {
    clearScreen();
    showBanner(active.name, true);

    // Auto-discover containers across launcher workspace
    let containers = await ModpackProfileManager.discoverClientContainers(baseDir, active.launcher);

    // If none found, create default Fabric and Forge containers
    if (containers.length === 0) {
      await ModpackProfileManager.resolveContainerForLoader(baseDir, "fabric", undefined, active.launcher);
      await ModpackProfileManager.resolveContainerForLoader(baseDir, "forge", undefined, active.launcher);
      containers = await ModpackProfileManager.discoverClientContainers(baseDir, active.launcher);
    }

    const launcherName = active.launcher ?? active.name ?? "Launcher";
    const totalProfilesAll = containers.reduce((sum, c) => sum + c.profilesCount, 0);
    const anyActive = containers.find((c) => c.activeProfileName);
    const statusOverview = anyActive
      ? chalk.hex(theme.success).bold(`● Aktif di ${anyActive.loader.toUpperCase()}: ${anyActive.activeProfileName}`)
      : chalk.hex(theme.muted)("○ Seluruh Client Bersih (Vanilla)");

    const cardContent =
      chalk.hex(theme.textMuted)("Instance  : ") +
      chalk.hex(theme.primary).bold(active.name ?? launcherName) +
      "   " +
      chalk.hex(theme.muted)("•") +
      "   " +
      chalk.hex(theme.textMuted)("Lokasi : ") +
      chalk.hex(theme.text)(baseDir) +
      "\n" +
      chalk.hex(theme.textMuted)("Status    : ") +
      statusOverview +
      "   " +
      chalk.hex(theme.muted)("•") +
      "   " +
      chalk.hex(theme.textMuted)("Koleksi : ") +
      chalk.hex(theme.info)(`${totalProfilesAll} Profil Tersimpan di ${containers.length} Wadah Client`);

    const renderClientMenuHeader = () => {
      showBanner(active.name, true);
      console.log(
        boxen(cardContent, {
          padding: {top: 0, bottom: 0, left: 2, right: 2},
          margin: {top: 0, bottom: 1, left: 0, right: 0},
          borderStyle: "round",
          borderColor: theme.border,
          title: chalk.hex(theme.primary).bold(` ❖ BRANKAS PROFIL MODPACK: ${launcherName.toUpperCase()} ❖ `),
          titleAlignment: "left",
        }),
      );
    };

    const clientChoices: InteractiveChoice[] = containers.map((c) => {
      const loaderUpper = c.loader.toUpperCase();
      const icon = c.loader === "fabric" ? "🟦" : c.loader === "forge" ? "🟧" : "🟪";
      const badgeVariant = c.loader === "fabric" ? "info" : c.loader === "forge" ? "warning" : "primary";
      const loaderBadge = formatBadge(loaderUpper, badgeVariant);
      const verBadge = formatBadge(`MC ${c.gameVersion}`, "muted");
      const activeBadge = c.activeProfileName
        ? formatBadge(c.activeProfileName, "success")
        : formatBadge("Bersih", "muted");

      return {
        name: `${icon}  Client ${loaderUpper} • MC ${c.gameVersion} (${c.containerName})`,
        value: c.containerDir,
        hint: `MC ${c.gameVersion} • ${c.profilesCount} profil tersimpan • ${c.activeProfileName ? `Aktif: ${c.activeProfileName}` : "Kondisi: Bersih / Siap"} • Folder: ${c.containerName}`,
        badge: `${loaderBadge} ${verBadge} ${activeBadge}`,
      };
    });

    const hasAnyActive = containers.some((c) => !!c.activeProfileName);
    clientChoices.push({name: "──────────────────────────────────────", value: "sep"});
    clientChoices.push({
      name: `📖  Panduan & Cara Menambah Wadah (${launcherName})`,
      value: "guide",
      hint: `Tutorial membuat wadah client versi baru di ${launcherName}`,
      badge: formatBadge("Panduan", "info"),
    });
    clientChoices.push({
      name: "🧹  Nonaktifkan Semua Modpack (Kembali Bersih Total)",
      value: "disable_all",
      hint: "Simpan modpack aktif ke profil & bersihkan seluruh folder wadah",
      badge: formatBadge(hasAnyActive ? "Bersihkan Semua" : "Semua Bersih", hasAnyActive ? "warning" : "muted"),
    });
    clientChoices.push({name: "──────────────────────────────────────", value: "sep"});
    clientChoices.push({name: "[Kembali ke Dashboard Utama]", value: "back"});

    const selectedContainerDir = await askInteractiveMenu(
      `PILIH CLIENT: ${launcherName.toUpperCase()}`,
      clientChoices,
      renderClientMenuHeader,
      {allowBackOnCancel: true},
    );

    if (selectedContainerDir === "guide") {
      if (active?.launcher === "Legacy") {
        await renderLegacyContainerGuide();
      } else {
        await renderTLauncherContainerGuide();
      }
      continue;
    }

    if (selectedContainerDir === "disable_all") {
      const confirmed = await p.confirm({
        message: "Simpan seluruh modpack aktif ke profil dan bersihkan SEMUA wadah client (kembali ke state awal)?",
        initialValue: true,
      });

      if (confirmed) {
        const s = p.spinner();
        s.start(`Menyimpan modpack aktif ke profil & membersihkan seluruh wadah ${launcherName}...`);
        try {
          const results = await ModpackProfileManager.disableAllModpackContainers(baseDir, active?.launcher);
          s.stop(pc.green(`Semua wadah ${launcherName} berhasil dibersihkan total dan kembali ke kondisi awal!`));

          for (const res of results) {
            if (res.disabledProfile) {
              p.log.info(`${pc.bold(res.containerName)}: Profil "${res.disabledProfile}" berhasil disimpan ke arsip.`);
            } else {
              p.log.message(pc.dim(`• ${res.containerName}: Sudah dalam kondisi bersih.`));
            }
          }

          if (active) {
            active.mode = "default";
            active.activeContainer = undefined;
            active.modsDir = path.join(active.rootDir ?? baseDir, "mods");
            await instanceConfig.save();
          }
        } catch (err: any) {
          s.stop(pc.red(`Gagal membersihkan wadah modpack: ${err.message}`));
        }
        await ask("Tekan Enter untuk melanjutkan...");
      }
      continue;
    }

    if (
      !selectedContainerDir ||
      selectedContainerDir === "back" ||
      selectedContainerDir.startsWith("sep")
    ) {
      inClientMenu = false;
      break;
    }

    const selectedContainer = containers.find((c) => c.containerDir === selectedContainerDir)!;

    // Saat beralih ke wadah client ini, bersihkan modpack wadah lain & sinkronkan versi MC seketika
    const isSwitchingClient =
      active.mode !== "modpack" || active.activeContainer !== selectedContainer.containerName;

    if (isSwitchingClient) {
      const s = p.spinner();
      s.start(`Membersihkan modpack sebelumnya & menyelaraskan versi ke ${selectedContainer.loader.toUpperCase()} ${selectedContainer.gameVersion}...`);
      try {
        for (const c of containers) {
          if (c.containerName !== selectedContainer.containerName && c.activeProfileName) {
            await ModpackProfileManager.disableProfile(c.containerDir);
          }
        }
        if (active.activeContainer && active.activeContainer !== selectedContainer.containerName) {
          const prevDir = path.join(baseDir, "versions", active.activeContainer);
          await ModpackProfileManager.disableProfile(prevDir);
        }

        active.mode = "modpack";
        active.activeContainer = selectedContainer.containerName;
        active.modsDir = path.join(selectedContainer.containerDir, "mods");
        active.gameVersion = selectedContainer.gameVersion;
        active.loader = selectedContainer.loader;
        await instanceConfig.save();

        s.stop(
          pc.green(
            `Versi Minecraft diselaraskan ke ${pc.bold(`${selectedContainer.loader.toUpperCase()} ${selectedContainer.gameVersion}`)} (${selectedContainer.containerName})!`,
          ),
        );
      } catch (err: any) {
        s.stop(pc.yellow(`Catatan sinkronisasi client: ${err.message}`));
      }
    }

    await runContainerProfileOperations(selectedContainer, active);
  }
}

async function runContainerProfileOperations(
  container: ClientContainerInfo,
  parentInstance: any,
): Promise<void> {
  const containerDir = container.containerDir;
  let inOperations = true;

  while (inOperations) {
    clearScreen();
    showBanner(`Client: ${container.containerName}`, true);

    await ModpackProfileManager.syncProfilesFromDownloads(containerDir);
    const activeInfo = await ModpackProfileManager.getActiveProfile(containerDir);
    const profiles = await ModpackProfileManager.listProfiles(containerDir);

    const loaderUpper = container.loader.toUpperCase();
    const activeBadge = activeInfo?.activeProfile
      ? chalk.hex(theme.success).bold(`● ${activeInfo.name ?? activeInfo.activeProfile} (Aktif)`)
      : chalk.hex(theme.muted)("○ Bersih / Non-Aktif (Vanilla)");

    const cardContent =
      chalk.hex(theme.textMuted)("Client    : ") +
      chalk.hex(theme.primary).bold(`${loaderUpper} • MC ${container.gameVersion} (${container.containerName})`) +
      "   " +
      chalk.hex(theme.muted)("•") +
      "   " +
      chalk.hex(theme.textMuted)("Wadah : ") +
      chalk.hex(theme.text)(container.containerDir) +
      "\n" +
      chalk.hex(theme.textMuted)("Status    : ") +
      activeBadge +
      "   " +
      chalk.hex(theme.muted)("•") +
      "   " +
      chalk.hex(theme.textMuted)("Arsip : ") +
      chalk.hex(theme.info)(`${profiles.length} Modpack Tersimpan di Brankas`);

    const renderOpsHeader = () => {
      showBanner(`Client: ${container.containerName}`, true);
      console.log(
        boxen(cardContent, {
          padding: {top: 0, bottom: 0, left: 2, right: 2},
          margin: {top: 0, bottom: 1, left: 0, right: 0},
          borderStyle: "round",
          borderColor: theme.border,
          title: chalk.hex(theme.primary).bold(` ❖ MANAJEMEN CLIENT: ${loaderUpper} ❖ `),
          titleAlignment: "left",
        }),
      );
    };

    const choices: InteractiveChoice[] = [
      {
        name: "🔄  Ganti Modpack Aktif (Switch Profile)",
        value: "switch",
        hint: profiles.length > 0
          ? `${profiles.length} modpack ${loaderUpper} tersimpan • Alihkan tanpa unduh ulang`
          : `Belum ada profil ${loaderUpper} tersimpan di wadah ini`,
        badge: formatBadge(profiles.length > 0 ? `${profiles.length} Siap` : "Kosong", profiles.length > 0 ? "primary" : "muted"),
      },
    ];

    if (activeInfo?.activeProfile) {
      choices.push({
        name: `○  Nonaktifkan Modpack Aktif (${activeInfo.name ?? activeInfo.activeProfile})`,
        value: "disable_current",
        hint: `Simpan ke brankas & kembalikan ${container.containerName} ke Vanilla bersih`,
        badge: formatBadge("Kembali Bersih", "warning"),
      });
    }

    choices.push(
      {
        name: `➕  Pasang Modpack Baru (${loaderUpper} • MC ${container.gameVersion})`,
        value: "install_new",
        hint: `Cari & pasang modpack resmi .mrpack dari Modrinth untuk ${loaderUpper} MC ${container.gameVersion}`,
        badge: formatBadge("Modrinth v2", "info"),
      },
      {
        name: "🗑️   Hapus Profil Modpack Tersimpan",
        value: "delete",
        hint: "Hapus arsip modpack dari penyimpanan brankas",
        badge: formatBadge("Kelola Arsip", "error"),
      },
      {name: "──────────────────────────────────────", value: "sep"},
      {name: "[Kembali ke Pilihan Client]", value: "back"},
    );

    const selected = await askInteractiveMenu(
      `OPERASI CLIENT ${container.loader.toUpperCase()}`,
      choices,
      renderOpsHeader,
      {allowBackOnCancel: true},
    );

    if (!selected || selected === "back" || selected === "sep") {
      inOperations = false;
      break;
    }

    switch (selected) {
      case "switch": {
        if (profiles.length === 0) {
          p.log.warn(`Belum ada profil modpack ${container.loader.toUpperCase()} yang tersimpan.`);
          await ask("Tekan Enter untuk melanjutkan...");
          break;
        }

        const profileChoices: InteractiveChoice[] = profiles.map((pr) => {
          const badge = pr.isActive
            ? formatBadge("SEDANG AKTIF", "success")
            : formatBadge(`${pr.filesCount} berkas`, "info");
          const dateStr = new Date(pr.updatedAt).toLocaleDateString();
          return {
            name: `📦  ${pr.name} (v${pr.versionId})`,
            value: pr.id,
            hint: `Loader: ${pr.loader ?? container.loader} ${pr.gameVersion ?? container.gameVersion} • File: ${pr.filesCount} berkas • Disimpan: ${dateStr}`,
            badge,
          };
        });

        profileChoices.push({name: "──────────────────────────────────────", value: "sep"});
        profileChoices.push({name: "[Batal]", value: "cancel"});

        const renderSwitchHeader = () => {
          showBanner(`Client: ${container.containerName}`, true);
          const switchCard =
            chalk.hex(theme.textMuted)("Wadah Client : ") +
            chalk.hex(theme.primary).bold(container.containerName) +
            "   " +
            chalk.hex(theme.muted)("•") +
            "   " +
            chalk.hex(theme.textMuted)("Target : ") +
            chalk.hex(theme.secondary).bold(`${loaderUpper} MC ${container.gameVersion}`) +
            "\n" +
            chalk.hex(theme.textMuted)("Status Aktif : ") +
            activeBadge;

          console.log(
            boxen(switchCard, {
              padding: {top: 0, bottom: 0, left: 2, right: 2},
              margin: {top: 0, bottom: 1, left: 0, right: 0},
              borderStyle: "round",
              borderColor: theme.border,
              title: chalk.hex(theme.primary).bold(" ❖ GANTI MODPACK AKTIF ❖ "),
              titleAlignment: "left",
            }),
          );
        };

        const targetId = await askInteractiveMenu(
          `PILIH MODPACK ${container.loader.toUpperCase()} UNTUK DIAKTIFKAN`,
          profileChoices,
          renderSwitchHeader,
        );

        if (!targetId || targetId === "cancel" || targetId === "sep") {
          break;
        }

        const s = p.spinner();
        s.start(`Mengalihkan wadah ${container.containerName} ke "${targetId}"...`);
        try {
          const activated = await ModpackProfileManager.activateProfile(containerDir, targetId);

          // Update active launcher mode in global config (keep single launcher instance)
          const activeKey = instanceConfig.get().activeInstance;
          if (activeKey && instanceConfig.get().instances[activeKey]) {
            const currentInst = instanceConfig.get().instances[activeKey];
            currentInst.mode = "modpack";
            currentInst.activeContainer = container.containerName;
            currentInst.modsDir = path.join(containerDir, "mods");
            if (activated.gameVersion ?? container.gameVersion) {
              currentInst.gameVersion = activated.gameVersion ?? container.gameVersion;
            }
            if (container.loader) {
              currentInst.loader = container.loader as any;
            }
          }
          await instanceConfig.save();

          s.stop(pc.green(`Modpack "${activated.name}" sekarang AKTIF di ${container.containerName}!`));
        } catch (err: any) {
          s.stop(pc.red(`Gagal mengalihkan: ${err.message}`));
        }
        await ask("Tekan Enter untuk melanjutkan...");
        break;
      }

      case "disable_current": {
        const s = p.spinner();
        s.start(`Menyimpan "${activeInfo?.name ?? activeInfo?.activeProfile}" & membersihkan wadah...`);
        try {
          await ModpackProfileManager.disableProfile(containerDir);
          s.stop(pc.green(`Wadah ${container.containerName} berhasil dibersihkan ke kondisi awal (Vanilla)!`));
        } catch (err: any) {
          s.stop(pc.red(`Gagal menonaktifkan modpack: ${err.message}`));
        }
        await ask("Tekan Enter untuk melanjutkan...");
        break;
      }

      case "install_new": {
        clearScreen();
        showBanner(`Client: ${container.containerName}`, true);
        const query = await ask(
          `Ketik nama modpack ${container.loader.toUpperCase()} (atau kosongkan untuk jelajahi semua):`,
        );

        const clientInstance = {
          ...parentInstance,
          name: `${parentInstance?.name ?? "Client"}: ${container.containerName}`,
          rootDir: containerDir,
          modsDir: path.join(containerDir, "mods"),
          gameVersion: container.gameVersion ?? "1.20.1",
          loader: container.loader,
        };

        await runInteractiveBrowser(clientInstance, query?.trim() ?? "", "modpack");
        break;
      }

      case "delete": {
        if (profiles.length === 0) {
          p.log.warn("Tidak ada profil untuk dihapus.");
          await ask("Tekan Enter untuk melanjutkan...");
          break;
        }

        const deleteChoices: InteractiveChoice[] = profiles.map((pr) => ({
          name: `🗑️   ${pr.name} (${pr.id})`,
          value: pr.id,
          hint: pr.isActive
            ? "Peringatan: Modpack ini sedang aktif di wadah game!"
            : `Arsip brankas berukuran ${pr.filesCount} berkas`,
          badge: pr.isActive
            ? formatBadge("SEDANG AKTIF", "warning")
            : formatBadge(`${pr.filesCount} berkas`, "muted"),
        }));
        deleteChoices.push({name: "──────────────────────────────────────", value: "sep"});
        deleteChoices.push({name: "[Batal]", value: "cancel"});

        const renderDeleteHeader = () => {
          showBanner(`Client: ${container.containerName}`, true);
          const delCard =
            chalk.hex(theme.textMuted)("Wadah Client : ") +
            chalk.hex(theme.primary).bold(container.containerName) +
            "   " +
            chalk.hex(theme.muted)("•") +
            "   " +
            chalk.hex(theme.textMuted)("Arsip : ") +
            chalk.hex(theme.info)(`${profiles.length} Profil Tersimpan`);

          console.log(
            boxen(delCard, {
              padding: {top: 0, bottom: 0, left: 2, right: 2},
              margin: {top: 0, bottom: 1, left: 0, right: 0},
              borderStyle: "round",
              borderColor: theme.border,
              title: chalk.hex(theme.error).bold(" ❖ HAPUS PROFIL ARSIP MODPACK ❖ "),
              titleAlignment: "left",
            }),
          );
        };

        const toDelete = await askInteractiveMenu(
          `PILIH PROFIL ${container.loader.toUpperCase()} UNTUK DIHAPUS`,
          deleteChoices,
          renderDeleteHeader,
        );

        if (!toDelete || toDelete === "cancel" || toDelete === "sep") {
          break;
        }

        const confirmed = await p.confirm({
          message: `Hapus profil "${toDelete}" secara permanen?`,
          initialValue: false,
        });

        if (confirmed) {
          const s = p.spinner();
          s.start(`Menghapus profil "${toDelete}"...`);
          try {
            await ModpackProfileManager.removeProfile(containerDir, toDelete);
            s.stop(pc.green(`Profil "${toDelete}" berhasil dihapus.`));
          } catch (err: any) {
            s.stop(pc.red(`Gagal menghapus: ${err.message}`));
          }
        }
        await ask("Tekan Enter untuk melanjutkan...");
        break;
      }
    }
  }
}

async function renderTLauncherContainerGuide(): Promise<void> {
  clearScreen();
  showBanner("Panduan Wadah TLauncher", true);

  const guideText = [
    chalk.hex(theme.primary).bold("📌 SISTEM WADAH CLIENT TLAUNCHER"),
    chalk.hex(theme.text)(
      "TLauncher mengisolasi setiap instalasi versi di dalam direktori:\n" +
      chalk.hex(theme.info)("  .minecraft/versions/<nama-wadah>/\n") +
      "Karena TLauncher memiliki sistem registrasi berkas internalnya sendiri,\n" +
      "wadah client baru maupun pengubahan versi harus dilakukan langsung dari TLauncher."
    ),
    "",
    chalk.hex(theme.secondary).bold("🎮 CARA MEMBUAT WADAH CLIENT BARU DI TLAUNCHER"),
    chalk.hex(theme.text)(
      "1. Buka aplikasi TLauncher di komputer Anda.\n" +
      "2. Klik tombol " + chalk.hex(theme.warning).bold("TL MODS") + " di sudut kanan bawah aplikasi TLauncher.\n" +
      "3. Di bagian tab atas, klik tombol " + chalk.hex(theme.primary).bold("Create / Buat Modpack") + ".\n" +
      "4. Masukkan Nama Modpack dengan awalan 'mypack', contoh:\n" +
      "   • " + chalk.hex(theme.info)("mypack(fabric)") + " atau " + chalk.hex(theme.info)("mypack(fabric-1.21)") + " untuk Fabric\n" +
      "   • " + chalk.hex(theme.warning)("mypack(forge)") + " atau " + chalk.hex(theme.warning)("mypack(forge-1.20)") + " untuk Forge\n" +
      "5. Pilih 'Game Version' (misal 1.20.1 atau 1.21.1) dan 'ModLoader' (Fabric / Forge).\n" +
      "6. Klik tombol " + chalk.hex(theme.primary).bold("Create") + " di TLauncher.\n" +
      "7. Buka kembali LoadModer, wadah baru akan langsung terdeteksi otomatis!"
    ),
    "",
    chalk.hex(theme.success).bold("ℹ️  INFORMASI VERSI MINECRAFT DI LOADMODER"),
    chalk.hex(theme.textMuted)(
      "Versi Minecraft yang ditampilkan di LoadModer (contoh: MC 1.20.1) bersifat informatif,\n" +
      "dibaca langsung dari metadata TLauncher agar modpack yang Anda unduh selalu cocok.\n" +
      "Untuk mengubah versi game wadah, sesuaikan langsung melalui TLauncher."
    ),
  ].join("\n");

  console.log(
    boxen(guideText, {
      padding: {top: 1, bottom: 1, left: 2, right: 2},
      margin: {top: 0, bottom: 1, left: 0, right: 0},
      borderStyle: "round",
      borderColor: theme.border,
      title: chalk.hex(theme.primary).bold(" ❖ PANDUAN PEMBUATAN WADAH TLAUNCHER ❖ "),
      titleAlignment: "center",
    }),
  );

  await ask("Tekan Enter untuk kembali ke menu client...");
}

async function renderLegacyContainerGuide(): Promise<void> {
  clearScreen();
  showBanner("Panduan Wadah Legacy Launcher", true);

  const guideText = [
    chalk.hex(theme.primary).bold("📌 ARSITEKTUR DUAL-PATH LEGACY LAUNCHER"),
    chalk.hex(theme.text)(
      "Legacy Launcher memisahkan file sistem engine dan wadah profil:\n" +
      chalk.hex(theme.info)("  • game/versions/<version>/  : Tempat engine jar & json yang diunduh\n") +
      chalk.hex(theme.info)("  • game/home/<profile>/      : Wadah profil permainan, mods, & modpack\n") +
      "LoadModer menempatkan dan mengelola seluruh modpack di dalam folder " +
      chalk.hex(theme.warning).bold("game/home/<profile>/mods") + "."
    ),
    "",
    chalk.hex(theme.secondary).bold("🎮 CARA MEMILIH / MENGUBAH VERSI DI LEGACY LAUNCHER"),
    chalk.hex(theme.text)(
      "1. Buka aplikasi Legacy Launcher di komputer Anda.\n" +
      "2. Pada menu pemilihan versi di layar utama, pilih versi ModLoader yang diinginkan (misal Fabric 26.2).\n" +
      "3. Legacy Launcher otomatis menyiapkan engine di " + chalk.hex(theme.info)("game/versions/") + " dan wadah di " + chalk.hex(theme.info)("game/home/") + ".\n" +
      "4. LoadModer otomatis membaca profil aktif dari konfigurasi Legacy Launcher (" + chalk.hex(theme.muted)("tl.properties") + ")."
    ),
    "",
    chalk.hex(theme.success).bold("🛡️  PENANGANAN MODPACK AKTIF (TANPA OVERWRITE)"),
    chalk.hex(theme.textMuted)(
      "LoadModer tidak mendukung penimpaan langsung (overwrite) modpack untuk mencegah konflik file.\n" +
      "Jika versi wadah sudah memiliki modpack aktif dan Anda ingin memasang modpack baru,\n" +
      "pilih 'Clean Install' agar modpack lama diamankan ke brankas profil dan wadah dibersihkan secara bersih."
    ),
  ].join("\n");

  console.log(
    boxen(guideText, {
      padding: {top: 1, bottom: 1, left: 2, right: 2},
      margin: {top: 0, bottom: 1, left: 0, right: 0},
      borderStyle: "round",
      borderColor: theme.border,
      title: chalk.hex(theme.primary).bold(" ❖ PANDUAN WADAH DUAL-PATH LEGACY LAUNCHER ❖ "),
      titleAlignment: "center",
    }),
  );

  await ask("Tekan Enter untuk kembali ke menu client...");
}

