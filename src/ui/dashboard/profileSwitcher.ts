import {readdir} from "node:fs/promises";
import chalk from "chalk";
import boxen from "boxen";
import {p, pc, showBanner, clearScreen} from "../prompts.js";
import {
  askInteractiveMenu,
  ask,
  getMinecraftVersionChoices,
  type InteractiveChoice,
} from "../interactive.js";
import {instanceConfig} from "../../core/instance/config.js";
import {profileSnapshotManager} from "../../core/profile/snapshotManager.js";
import {SUPPORTED_LOADERS} from "../../constants.js";
import type {SavedInstanceConfig} from "../../types/instance.js";
import {initCommand} from "../../commands/init.js";
import {runInteractiveModeSwitcher} from "./modeSwitcher.js";
import {theme, formatBadge} from "../theme.js";
import {getLauncherCapabilities} from "../../core/instance/capabilities.js";

export async function runInteractiveProfileSwitcher(activeInstanceKey?: string): Promise<void> {
  await instanceConfig.load();
  const cfg = instanceConfig.get();
  const activeKey = activeInstanceKey || cfg.activeInstance;

  if (!activeKey || !cfg.instances[activeKey]) {
    p.log.warn("Belum ada instance Minecraft yang aktif. Menjalankan inisialisasi...");
    await initCommand();
    return;
  }

  const instance = cfg.instances[activeKey];
  let inProfileMenu = true;

  while (inProfileMenu) {
    await instanceConfig.load();
    const freshCfg = instanceConfig.get();
    const freshInst = freshCfg.instances[activeKey];
    if (freshInst) {
      Object.assign(instance, freshInst);
    }

    let currentModsCount = 0;
    try {
      const files = await readdir(instance.modsDir);
      currentModsCount = files.filter(
        (f) => f.endsWith(".jar") || f.endsWith(".jar.disabled"),
      ).length;
    } catch {}

    const snapshots = await profileSnapshotManager.listSnapshots(instance);
    const caps = getLauncherCapabilities(instance.launcher);

    const choices: InteractiveChoice[] = [
      {
        name: "🔄  Ganti Versi Game & Mod Loader (Auto-Snapshot & Restore)",
        value: "switch",
        hint: `Saat ini: ${instance.loader ?? "-"} ${instance.gameVersion ?? "-"} (${currentModsCount} mod)`,
      },
      {
        name: "📦  Daftar Snapshot Profil Tersimpan",
        value: "snapshots",
        hint: `${snapshots.length} snapshot tersimpan`,
      },
    ];

    if (caps.supportsModeSwitch) {
      choices.push({
        name: "🔀  Ganti Mode / Wadah Target (Default ↔ Modpack)",
        value: "switch_mode",
        hint: `Saat ini: ${instance.mode === "modpack" ? `Modpack (${instance.activeContainer ?? "-"})` : "Default (.minecraft)"}`,
      });
    }

    choices.push(
      {
        name: "🎮  Ganti ke Instance Launcher Lain",
        value: "change_instance",
        hint: "Prism, Vanilla, MultiMC, CurseForge",
      },
      {name: "──────────────────", value: "sep"},
      {name: "[Kembali ke Dashboard Utama]", value: "back"},
    );

    const selected = await askInteractiveMenu(
      `KELOLA PROFIL & VERSI: ${instance.name.toUpperCase()}`,
      choices,
      () => {
        showBanner(
          instance.name,
          true,
          false,
          caps.supportsContainers
            ? `Mode: ${instance.mode === "modpack" ? `modpack (${instance.activeContainer ?? "-"})` : "default"} • ${instance.loader?.toUpperCase() ?? "-"} ${instance.gameVersion ?? "-"}`
            : `${instance.loader?.toUpperCase() ?? "-"} ${instance.gameVersion ?? "-"}`,
        );

        const modeDisplay = instance.mode === "modpack"
          ? chalk.hex(theme.info).bold(`● Modpack (${instance.activeContainer ?? "wadah"})`)
          : chalk.hex(theme.secondary).bold("○ Default (Standar Launcher)");

        const cardContent =
          chalk.hex(theme.textMuted)("Instance   : ") +
          chalk.hex(theme.primary).bold(instance.name) +
          "   " +
          chalk.hex(theme.muted)("•") +
          "   " +
          chalk.hex(theme.textMuted)("Launcher : ") +
          chalk.hex(theme.text)(instance.launcher ?? "Game") +
          "\n" +
          chalk.hex(theme.textMuted)("Mod Loader : ") +
          chalk.hex(theme.secondary).bold(`${instance.loader?.toUpperCase() ?? "-"} ${instance.gameVersion ?? "-"}`) +
          (caps.supportsContainers
            ? "   " +
              chalk.hex(theme.muted)("•") +
              "   " +
              chalk.hex(theme.textMuted)("Mode : ") +
              modeDisplay
            : "") +
          "\n" +
          chalk.hex(theme.textMuted)("Folder Mods: ") +
          chalk.hex(theme.textMuted)(instance.modsDir) +
          "   " +
          chalk.hex(theme.muted)("•") +
          "   " +
          chalk.hex(theme.textMuted)("Mod Terpasang : ") +
          chalk.hex(theme.success)(`${currentModsCount} mod`);

        console.log(
          boxen(cardContent, {
            padding: {top: 0, bottom: 0, left: 2, right: 2},
            margin: {top: 0, bottom: 1, left: 0, right: 0},
            borderStyle: "round",
            borderColor: theme.border,
            title: chalk.hex(theme.primary).bold(` ❖ KELOLA PROFIL & VERSI: ${instance.name.toUpperCase()} ❖ `),
            titleAlignment: "left",
          }),
        );
      },
    );

    if (!selected || selected === "back" || selected === "sep") {
      clearScreen();
      inProfileMenu = false;
      break;
    }

    switch (selected) {
      case "switch": {
        await handleSwitchFlow(activeKey, instance, currentModsCount);
        await instanceConfig.load();
        const updated = instanceConfig.getActiveInstance();
        if (updated) Object.assign(instance, updated);
        break;
      }

      case "snapshots": {
        await handleSnapshotsListFlow(activeKey, instance);
        await instanceConfig.load();
        const updated = instanceConfig.getActiveInstance();
        if (updated) Object.assign(instance, updated);
        break;
      }

      case "switch_mode": {
        await runInteractiveModeSwitcher();
        await instanceConfig.load();
        const updated = instanceConfig.getActiveInstance();
        if (updated) Object.assign(instance, updated);
        break;
      }

      case "change_instance": {
        const switched = await handleLauncherSwitchFlow(activeKey, instance);
        if (switched) {
          inProfileMenu = false;
          return;
        }
        break;
      }
    }
  }
}

async function handleLauncherSwitchFlow(
  activeKey: string,
  currentInstance: SavedInstanceConfig,
): Promise<boolean> {
  await instanceConfig.load();
  const cfg = instanceConfig.get();
  const savedEntries = Object.entries(cfg.instances);

  const choices: InteractiveChoice[] = [];

  choices.push({name: "LAUNCHER TERSIMPAN", value: "sep"});
  for (const [key, inst] of savedEntries) {
    const isActive = key === activeKey;
    const modeBadge = inst.mode === "modpack"
      ? `Modpack (${inst.activeContainer ?? "wadah"})`
      : "Default";
    const hintText = isActive
      ? `Sedang aktif • Mode: ${modeBadge} • ${inst.loader ?? "-"} ${inst.gameVersion ?? "-"}`
      : `Folder: ${inst.rootDir} • Mode: ${modeBadge}`;

    choices.push({
      name: `${isActive ? "● " : "○ "}[${inst.launcher ?? "Game"}] ${inst.name}`,
      value: `select_${key}`,
      hint: hintText,
      badge: formatBadge(isActive ? "Sedang Aktif" : (inst.mode === "modpack" ? "Modpack" : "Default"), isActive ? "success" : "muted"),
    });
  }

  choices.push({name: "PINDAI / TAMBAH LAUNCHER", value: "sep"});
  choices.push({
    name: "🔍  Pindai Semua Launcher & Drive...",
    value: "action_scan",
    hint: "Prism, MultiMC, Modrinth, CurseForge, Vanilla, SKLauncher, Legacy",
    badge: formatBadge("Pindai", "info"),
  });
  choices.push({
    name: "✏️   Masukkan Path Folder Game Manual...",
    value: "action_manual",
    hint: "Ketik folder .minecraft / game di drive mana saja",
    badge: formatBadge("Manual", "warning"),
  });

  choices.push({name: "──────────────────────────────────────", value: "sep"});
  choices.push({name: "[Kembali ke Menu Profil]", value: "back"});

  const renderLauncherSwitchHeader = () => {
    showBanner(
      currentInstance.name,
      true,
      false,
      `Saat ini: ${currentInstance.launcher ?? "Game"} (${currentInstance.loader ?? "-"} ${currentInstance.gameVersion ?? "-"})`,
    );

    const modeText = currentInstance.mode === "modpack"
      ? chalk.hex(theme.info).bold(`● Modpack (${currentInstance.activeContainer ?? "wadah"})`)
      : chalk.hex(theme.secondary).bold("○ Default (Standar Launcher)");

    const card =
      chalk.hex(theme.textMuted)("Launcher Aktif : ") +
      chalk.hex(theme.primary).bold(currentInstance.name) +
      "   " +
      chalk.hex(theme.muted)("•") +
      "   " +
      chalk.hex(theme.textMuted)("Mode : ") +
      modeText +
      "\n" +
      chalk.hex(theme.textMuted)("Lokasi Game    : ") +
      chalk.hex(theme.text)(currentInstance.rootDir) +
      "   " +
      chalk.hex(theme.muted)("•") +
      "   " +
      chalk.hex(theme.textMuted)("Terdaftar : ") +
      chalk.hex(theme.info)(`${savedEntries.length} Launcher`);

    console.log(
      boxen(card, {
        padding: {top: 0, bottom: 0, left: 2, right: 2},
        margin: {top: 0, bottom: 1, left: 0, right: 0},
        borderStyle: "round",
        borderColor: theme.border,
        title: chalk.hex(theme.primary).bold(" ❖ PILIH LAUNCHER MINECRAFT ❖ "),
        titleAlignment: "left",
      }),
    );
  };

  const selected = await askInteractiveMenu(
    "GANTI KE LAUNCHER LAIN",
    choices,
    renderLauncherSwitchHeader,
  );

  if (!selected || selected === "back" || selected === "sep") {
    return false;
  }

  if (selected.startsWith("select_")) {
    const targetKey = selected.replace("select_", "");
    if (targetKey === activeKey) {
      clearScreen();
      showBanner(currentInstance.name, true);
      p.log.info(pc.cyan(`Instance "${currentInstance.name}" sudah merupakan instance aktif.`));
      await ask("Tekan Enter untuk kembali...");
      return false;
    }

    const targetInst = cfg.instances[targetKey];
    if (targetInst) {
      instanceConfig.setActiveInstance(targetKey);
      await instanceConfig.save();

      clearScreen();
      showBanner(targetInst.name, true);
      p.note(
        `Instance Baru   : ${pc.bold(targetInst.name)} (${targetInst.launcher ?? "Game"})\n` +
          `Folder Mods     : ${pc.dim(targetInst.modsDir)}\n` +
          `Minecraft       : ${pc.green(targetInst.gameVersion ?? "-")}\n` +
          `Mod Loader      : ${pc.cyan(targetInst.loader ?? "-")}`,
        "Berhasil Beralih Instance",
      );
      await ask("Tekan Enter untuk melanjutkan ke dashboard...");
      return true;
    }
    return false;
  }

  if (selected === "action_scan") {
    clearScreen();
    await initCommand({skipBanner: true, allowCancel: true});
    await instanceConfig.load();
    const freshCfg = instanceConfig.get();
    if (freshCfg.activeInstance && freshCfg.activeInstance !== activeKey) {
      await ask("Tekan Enter untuk melanjutkan ke dashboard...");
      return true;
    }
    return false;
  }

  if (selected === "action_manual") {
    clearScreen();
    showBanner(currentInstance.name, true);
    const manualInput = await ask("Masukkan path folder .minecraft / game (kosongkan untuk batal):");
    if (!manualInput || !manualInput.trim()) {
      return false;
    }
    await initCommand({path: manualInput.trim(), skipBanner: true, allowCancel: true});
    await instanceConfig.load();
    const freshCfg = instanceConfig.get();
    if (freshCfg.activeInstance && freshCfg.activeInstance !== activeKey) {
      await ask("Tekan Enter untuk melanjutkan ke dashboard...");
      return true;
    }
    return false;
  }

  return false;
}

async function handleSwitchFlow(
  instanceKey: string,
  instance: SavedInstanceConfig,
  _currentModsCount: number,
): Promise<void> {
  await instanceConfig.load();
  const freshCfg = instanceConfig.get();
  const freshInst = freshCfg.instances[instanceKey];
  if (freshInst) {
    Object.assign(instance, freshInst);
  }

  const loaderChoices: InteractiveChoice[] = SUPPORTED_LOADERS.map((ldr) => ({
    name: `${ldr === instance.loader ? "● " : "○ "}${ldr.toUpperCase()}${ldr === "fabric" ? " (Rekomendasi)" : ""}`,
    value: ldr,
    hint: ldr === instance.loader ? "Aktif saat ini" : undefined,
  }));
  loaderChoices.push({name: "──────────────────", value: "sep"});
  loaderChoices.push({name: "[Batal]", value: "cancel"});

  const chosenLoader = await askInteractiveMenu("Pilih Mod Loader Target:", loaderChoices, () => {
    showBanner(instance.name, true);
    p.log.info(
      pc.cyan(
        `Profil: ${pc.bold(instance.name)} | Saat ini: ${pc.bold(instance.loader || "-")} ${pc.bold(instance.gameVersion || "-")}`,
      ),
    );
  });
  if (!chosenLoader || chosenLoader === "cancel" || chosenLoader === "sep") return;

  const versionChoices = await getMinecraftVersionChoices(instance.gameVersion);
  versionChoices.push({name: "──────────────────", value: "sep"});
  versionChoices.push({name: "✏️   Ketik Versi Minecraft Lainnya...", value: "custom"});
  versionChoices.push({name: "[Batal]", value: "cancel"});

  const chosenVersionOption = await askInteractiveMenu(
    "Pilih Versi Minecraft Target:",
    versionChoices,
    () => {
      showBanner(instance.name, true);
      p.log.info(pc.cyan(`Target Loader Dipilih: ${pc.bold(chosenLoader.toUpperCase())}`));
    },
  );
  if (!chosenVersionOption || chosenVersionOption === "cancel" || chosenVersionOption === "sep")
    return;

  let targetVersion = chosenVersionOption;
  if (chosenVersionOption === "custom") {
    const customInput = await ask(
      "Masukkan versi Minecraft yang diinginkan (misal: 1.20.6 atau 26.2):",
    );
    if (!customInput || !customInput.trim()) {
      p.log.warn("Versi tidak boleh kosong.");
      await ask("Tekan Enter untuk melanjutkan...");
      return;
    }
    targetVersion = customInput.trim();
  }

  const s = p.spinner();
  s.start(
    `Menyimpan mod ${instance.loader ?? ""} ${instance.gameVersion ?? ""} dan menyiapkan ${chosenLoader} ${targetVersion}...`,
  );

  try {
    const result = await profileSnapshotManager.switchProfile(
      instanceKey,
      chosenLoader,
      targetVersion,
    );
    await instanceConfig.load();
    const updatedInst = instanceConfig.getActiveInstance();
    if (updatedInst) Object.assign(instance, updatedInst);
    s.stop(pc.green("Pengalihan profil selesai!"));

    const prevText = result.previousSnapshot
      ? `${result.previousSnapshot.loader} ${result.previousSnapshot.gameVersion} (${result.savedCount} mod diarsipkan)`
      : "Tidak ada mod";

    const newText = result.isNewProfile
      ? `${pc.cyan("Profil Baru Bersih")} (Folder mods kosong, siap untuk mod ${chosenLoader} ${targetVersion})`
      : `${pc.green("Snapshot Ditemukan!")} (${result.restoredCount} mod berhasil dikembalikan)`;

    p.note(
      `Instance       : ${pc.bold(instance.name)}\n` +
        `Profil Aktif   : ${pc.bold(pc.green(`${chosenLoader} ${targetVersion}`))}\n` +
        `Snapshot Lama  : ${pc.dim(prevText)}\n` +
        `Status Folder  : ${newText}\n` +
        `Lokasi Mods    : ${pc.dim(instance.modsDir)}`,
      "Pergantian Profil Berhasil",
    );
  } catch (err: any) {
    s.stop(pc.red("Gagal mengalihkan profil!"));
    p.log.error(err.message || "Terjadi kesalahan sistem.");
  }

  await ask("Tekan Enter untuk kembali...");
}

async function handleSnapshotsListFlow(
  instanceKey: string,
  instance: SavedInstanceConfig,
): Promise<void> {
  await instanceConfig.load();
  const freshCfg = instanceConfig.get();
  const freshInst = freshCfg.instances[instanceKey];
  if (freshInst) Object.assign(instance, freshInst);

  const snapshots = await profileSnapshotManager.listSnapshots(instance);

  if (snapshots.length === 0) {
    clearScreen();
    showBanner(instance.name, true);
    p.log.info(pc.yellow("Belum ada snapshot profil yang tersimpan untuk instance ini."));
    p.log.message(
      pc.dim(
        "Snapshot otomatis dibuat saat Anda mengganti versi Minecraft atau mod loader melalui menu LoadModer.",
      ),
    );
    await ask("Tekan Enter untuk kembali...");
    return;
  }

  const choices: InteractiveChoice[] = snapshots.map((s) => {
    const isCurrent =
      s.loader.toLowerCase() === (instance.loader || "").toLowerCase() &&
      s.gameVersion.toLowerCase() === (instance.gameVersion || "").toLowerCase();

    return {
      name: `${isCurrent ? "● " : "○ "}${s.loader.toUpperCase()} ${s.gameVersion} (${s.modsCount} mod)`,
      value: s.snapshotId,
      hint: isCurrent
        ? "Sedang aktif di instance ini"
        : `Tersimpan: ${new Date(s.updatedAt).toLocaleDateString()}`,
      badge: formatBadge(isCurrent ? "Aktif" : `${s.modsCount} mod`, isCurrent ? "success" : "muted"),
    };
  });

  choices.push({name: "──────────────────", value: "sep"});
  choices.push({name: "[Kembali]", value: "back"});

  const renderSnapshotsHeader = () => {
    showBanner(instance.name, true);
    const cardContent =
      chalk.hex(theme.textMuted)("Instance  : ") +
      chalk.hex(theme.primary).bold(instance.name) +
      "   " +
      chalk.hex(theme.muted)("•") +
      "   " +
      chalk.hex(theme.textMuted)("Aktif : ") +
      chalk.hex(theme.secondary).bold(`${instance.loader?.toUpperCase() ?? "-"} ${instance.gameVersion ?? "-"}`) +
      "\n" +
      chalk.hex(theme.textMuted)("Snapshot  : ") +
      chalk.hex(theme.info)(`${snapshots.length} Snapshot Profil Tersimpan`) +
      "   " +
      chalk.hex(theme.muted)("•") +
      "   " +
      chalk.hex(theme.textMuted)("Folder : ") +
      chalk.hex(theme.textMuted)(instance.modsDir);

    console.log(
      boxen(cardContent, {
        padding: {top: 0, bottom: 0, left: 2, right: 2},
        margin: {top: 0, bottom: 1, left: 0, right: 0},
        borderStyle: "round",
        borderColor: theme.border,
        title: chalk.hex(theme.primary).bold(" ❖ DAFTAR SNAPSHOT PROFIL ❖ "),
        titleAlignment: "left",
      }),
    );
  };

  const chosenSnapshotId = await askInteractiveMenu("DAFTAR SNAPSHOT TERSIMPAN", choices, renderSnapshotsHeader);
  if (!chosenSnapshotId || chosenSnapshotId === "back" || chosenSnapshotId === "sep") return;

  const targetSnapshot = snapshots.find((s) => s.snapshotId === chosenSnapshotId);
  if (!targetSnapshot) return;

  const subChoices: InteractiveChoice[] = [
    {
      name: "▶️  Terapkan & Switch ke Snapshot ini Sekarang",
      value: "apply",
      hint: `Pulihkan ${targetSnapshot.modsCount} mod ke folder ${instance.modsDir}`,
      badge: formatBadge("Terapkan", "primary"),
    },
    {
      name: "👁️  Lihat Daftar Mod dalam Snapshot",
      value: "view",
      hint: `Rincian ${targetSnapshot.mods.length} berkas mod yang tersimpan di snapshot ini`,
      badge: formatBadge("Rincian", "info"),
    },
    {
      name: "🗑️  Hapus Snapshot ini",
      value: "delete",
      hint: "Hapus snapshot ini secara permanen dari penyimpanan",
      badge: formatBadge("Hapus", "error"),
    },
    {name: "──────────────────", value: "sep"},
    {name: "[Kembali]", value: "back"},
  ];

  const renderSubHeader = () => {
    showBanner(instance.name, true);
    const subCard =
      chalk.hex(theme.textMuted)("Target    : ") +
      chalk.hex(theme.primary).bold(`${targetSnapshot.loader.toUpperCase()} ${targetSnapshot.gameVersion}`) +
      "   " +
      chalk.hex(theme.muted)("•") +
      "   " +
      chalk.hex(theme.textMuted)("Mod : ") +
      chalk.hex(theme.info)(`${targetSnapshot.modsCount} mod`) +
      "\n" +
      chalk.hex(theme.textMuted)("Snapshot  : ") +
      chalk.hex(theme.text)(targetSnapshot.snapshotId) +
      "   " +
      chalk.hex(theme.muted)("•") +
      "   " +
      chalk.hex(theme.textMuted)("Dibuat : ") +
      chalk.hex(theme.textMuted)(new Date(targetSnapshot.createdAt).toLocaleDateString());

    console.log(
      boxen(subCard, {
        padding: {top: 0, bottom: 0, left: 2, right: 2},
        margin: {top: 0, bottom: 1, left: 0, right: 0},
        borderStyle: "round",
        borderColor: theme.border,
        title: chalk.hex(theme.primary).bold(` ❖ SNAPSHOT: ${targetSnapshot.loader.toUpperCase()} ${targetSnapshot.gameVersion} ❖ `),
        titleAlignment: "left",
      }),
    );
  };

  const subSelected = await askInteractiveMenu(
    `SNAPSHOT: ${targetSnapshot.loader.toUpperCase()} ${targetSnapshot.gameVersion}`,
    subChoices,
    renderSubHeader,
  );

  if (subSelected === "apply") {
    const s = p.spinner();
    s.start(`Menerapkan snapshot ${targetSnapshot.loader} ${targetSnapshot.gameVersion}...`);
    try {
      const res = await profileSnapshotManager.switchProfile(
        instanceKey,
        targetSnapshot.loader,
        targetSnapshot.gameVersion,
      );
      await instanceConfig.load();
      const updatedInst = instanceConfig.getActiveInstance();
      if (updatedInst) Object.assign(instance, updatedInst);
      s.stop(pc.green("Snapshot berhasil diterapkan!"));
      p.note(
        `Profil Aktif : ${targetSnapshot.loader} ${targetSnapshot.gameVersion}\n` +
          `Mod Pulih    : ${res.restoredCount} mod dikembalikan ke folder mods`,
        "Berhasil",
      );
    } catch (err: any) {
      s.stop(pc.red("Gagal menerapkan snapshot!"));
      p.log.error(err.message);
    }
    await ask("Tekan Enter untuk kembali...");
  } else if (subSelected === "view") {
    clearScreen();
    showBanner(instance.name, true);
    p.log.info(
      pc.cyan(
        `Mod dalam Snapshot ${targetSnapshot.loader.toUpperCase()} ${targetSnapshot.gameVersion} (${targetSnapshot.modsCount} mod):`,
      ),
    );
    if (targetSnapshot.mods.length === 0) {
      p.log.message(pc.dim("Tidak ada berkas mod dalam snapshot ini."));
    } else {
      for (const m of targetSnapshot.mods) {
        const status = m.disabled ? pc.yellow("[Nonaktif]") : pc.green("[Aktif]");
        p.log.message(` • ${status} ${m.filename} ${m.slug ? pc.dim(`(${m.slug})`) : ""}`);
      }
    }
    await ask("Tekan Enter untuk kembali...");
  } else if (subSelected === "delete") {
    const s = p.spinner();
    s.start(`Menghapus snapshot ${targetSnapshot.snapshotId}...`);
    const success = await profileSnapshotManager.deleteSnapshot(
      instance,
      targetSnapshot.snapshotId,
    );
    if (success) {
      s.stop(pc.green("Snapshot berhasil dihapus."));
    } else {
      s.stop(pc.red("Gagal menghapus snapshot."));
    }
    await ask("Tekan Enter untuk kembali...");
  }
}
