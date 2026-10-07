import path from "node:path";
import chalk from "chalk";
import boxen from "boxen";
import { p, pc, showBanner, clearScreen } from "../prompts.js";
import { askInteractiveMenu, ask, type InteractiveChoice } from "../interactive.js";
import { formatBadge, theme } from "../theme.js";
import { instanceConfig } from "../../core/instance/config.js";
import { ModpackProfileManager } from "../../core/modpack/profileManager.js";

export async function runInteractiveModeSwitcher(): Promise<boolean> {
  await instanceConfig.load();
  const activeKey = instanceConfig.get().activeInstance;
  if (!activeKey || !instanceConfig.get().instances[activeKey]) {
    p.log.warn("Tidak ada instance launcher aktif.");
    return false;
  }

  const active = instanceConfig.get().instances[activeKey];
  const launcherName = active.launcher ?? "Launcher";
  const baseDir = active.rootDir ?? path.dirname(active.modsDir);
  const isLegacy = active.launcher === "Legacy";
  const wadahFolder = isLegacy ? "home/" : "versions/";

  const containers = await ModpackProfileManager.discoverClientContainers(baseDir, active.launcher);

  const choices: InteractiveChoice[] = [];
  const currentMode = active.mode ?? "default";
  const currentContainer = active.activeContainer;
  const isDefaultActive = currentMode === "default";

  // Opsi 1: Mode Default
  choices.push({
    name: "📁  Mode Default (Standar Launcher)",
    value: "mode_default",
    hint: `Target: ${path.join(active.rootDir, "mods")} • ${isDefaultActive ? "Sedang aktif" : "Beralih ke folder mods standar"}`,
    badge: formatBadge(isDefaultActive ? "Aktif" : "Standar", isDefaultActive ? "success" : "muted"),
  });

  // Opsi 2: Wadah Modpack Khusus (jika ada)
  if (containers.length > 0) {
    for (const c of containers) {
      const isContainerActive = currentMode === "modpack" && currentContainer === c.containerName;
      const loaderUpper = c.loader.toUpperCase();
      const statusDesc = c.activeProfileName ? `Profil Aktif: ${c.activeProfileName}` : "Kondisi: Bersih";
      const icon = c.loader === "fabric" ? "🟦" : c.loader === "forge" ? "🟧" : "🟪";

      choices.push({
        name: `${icon}  Mode Modpack: ${c.containerName} (MC ${c.gameVersion} ${loaderUpper})`,
        value: `container_${c.containerName}`,
        hint: `Folder: ${wadahFolder}${c.containerName}/mods • ${c.profilesCount} profil tersimpan • ${statusDesc}`,
        badge: formatBadge(
          isContainerActive ? "Aktif" : `${c.profilesCount} Profil`,
          isContainerActive ? "success" : "info",
        ),
      });
    }
  }

  choices.push({ name: "──────────────────────────────────────", value: "sep" });
  choices.push({ name: "[Kembali]", value: "back" });

  const renderHeader = () => {
    showBanner(
      active.name,
      true,
      false,
      `Mode: ${currentMode === "modpack" ? `modpack (${currentContainer ?? "-"})` : "default"}`,
    );

    const modeDisplay = currentMode === "modpack"
      ? chalk.hex(theme.info).bold(`● Modpack (${currentContainer ?? "wadah"})`)
      : chalk.hex(theme.secondary).bold("○ Default (Standar Launcher)");

    const wadahLine = containers.length > 0
      ? "\n" +
        chalk.hex(theme.textMuted)("Wadah      : ") +
        chalk.hex(theme.info)(`${containers.length} Wadah Versi Terdeteksi di ${wadahFolder}`)
      : "\n" +
        chalk.hex(theme.textMuted)("Wadah      : ") +
        chalk.hex(theme.muted)("Tidak ada wadah versi terdeteksi (Berjalan di Mode Default)");

    const cardContent =
      chalk.hex(theme.textMuted)("Launcher   : ") +
      chalk.hex(theme.primary).bold(active.name) +
      "   " +
      chalk.hex(theme.muted)("•") +
      "   " +
      chalk.hex(theme.textMuted)("Lokasi : ") +
      chalk.hex(theme.text)(active.rootDir) +
      "\n" +
      chalk.hex(theme.textMuted)("Mode Aktif : ") +
      modeDisplay +
      "   " +
      chalk.hex(theme.muted)("•") +
      "   " +
      chalk.hex(theme.textMuted)("Folder Mods : ") +
      chalk.hex(theme.textMuted)(active.modsDir) +
      wadahLine;

    console.log(
      boxen(cardContent, {
        padding: { top: 0, bottom: 0, left: 2, right: 2 },
        margin: { top: 0, bottom: 1, left: 0, right: 0 },
        borderStyle: "round",
        borderColor: theme.border,
        title: chalk.hex(theme.primary).bold(` ❖ KELOLA MODE LAUNCHER: ${launcherName.toUpperCase()} ❖ `),
        titleAlignment: "left",
      }),
    );
  };

  const selected = await askInteractiveMenu(
    `PILIH MODE / TIPE LAUNCHER: ${launcherName.toUpperCase()}`,
    choices,
    renderHeader,
  );

  if (!selected || selected === "back" || selected === "sep" || selected.startsWith("sep")) {
    return false;
  }

  if (selected === "mode_default") {
    const s = p.spinner();
    s.start("Menonaktifkan semua modpack aktif & membersihkan seluruh wadah client...");
    try {
      const results = await ModpackProfileManager.disableAllModpackContainers(baseDir, active.launcher);
      s.stop(pc.green("Semua wadah modpack berhasil dinonaktifkan & disimpan ke arsip!"));
      for (const res of results) {
        if (res.disabledProfile) {
          p.log.info(`${pc.bold(res.containerName)}: Profil "${res.disabledProfile}" berhasil disimpan ke arsip.`);
        }
      }
    } catch (err: any) {
      s.stop(pc.red(`Gagal membersihkan wadah modpack: ${err.message}`));
    }

    active.mode = "default";
    active.activeContainer = undefined;
    active.modsDir = path.join(active.rootDir, "mods");
    await instanceConfig.save();

    clearScreen();
    showBanner(active.name, true);
    p.note(
      `Launcher   : ${pc.bold(active.name)}\n` +
        `Mode       : ${pc.green("Default (Standar Launcher)")}\n` +
        `Folder Mods: ${pc.dim(active.modsDir)}\n` +
        `Kondisi    : ${pc.cyan("Bersih (Seluruh wadah modpack dinonaktifkan)")}\n` +
        `Versi MC   : ${pc.cyan(active.gameVersion ?? "-")}\n` +
        `Mod Loader : ${pc.cyan(active.loader ?? "-")}`,
      "Mode Launcher Diperbarui",
    );
    await ask("Tekan Enter untuk kembali ke dashboard...");
    return true;
  }

  if (selected.startsWith("container_")) {
    const targetContainerName = selected.replace("container_", "");
    const targetContainer = containers.find((c) => c.containerName === targetContainerName);
    if (!targetContainer) return false;

    const s = p.spinner();
    s.start(`Menonaktifkan modpack mode sebelumnya & menyiapkan wadah ${targetContainer.containerName}...`);
    try {
      for (const c of containers) {
        if (c.containerName !== targetContainer.containerName && c.activeProfileName) {
          await ModpackProfileManager.disableProfile(c.containerDir);
        }
      }
      if (active.activeContainer && active.activeContainer !== targetContainer.containerName) {
        const prevContainer = containers.find((c) => c.containerName === active.activeContainer);
        const prevDir = prevContainer
          ? prevContainer.containerDir
          : path.join(baseDir, isLegacy ? "home" : "versions", active.activeContainer);
        await ModpackProfileManager.disableProfile(prevDir);
      }
      s.stop(pc.green(`Modpack sebelumnya dinonaktifkan. Wadah ${targetContainer.containerName} aktif!`));
    } catch (err: any) {
      s.stop(pc.yellow(`Sinkronisasi wadah: ${err.message}`));
    }

    active.mode = "modpack";
    active.activeContainer = targetContainer.containerName;
    active.modsDir = path.join(targetContainer.containerDir, "mods");
    active.gameVersion = targetContainer.gameVersion;
    active.loader = targetContainer.loader;
    await instanceConfig.save();

    clearScreen();
    showBanner(active.name, true);
    p.note(
      `Launcher   : ${pc.bold(active.name)}\n` +
        `Mode       : ${pc.cyan(`Modpack (${targetContainer.containerName})`)}\n` +
        `Folder Mods: ${pc.dim(active.modsDir)}\n` +
        `Versi MC   : ${pc.green(targetContainer.gameVersion)}\n` +
        `Mod Loader : ${pc.cyan(targetContainer.loader)}`,
      "Mode Launcher Diperbarui",
    );
    await ask("Tekan Enter untuk kembali ke dashboard...");
    return true;
  }

  return false;
}
