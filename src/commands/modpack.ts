import path from "node:path";
import {ModpackProfileManager} from "../core/modpack/profileManager.js";
import {instanceConfig} from "../core/instance/config.js";
import {p, pc, showBanner, exitIfCancel} from "../ui/prompts.js";

export async function resolveInstanceDir(customDir?: string): Promise<string | null> {
  if (customDir) {
    return path.resolve(customDir);
  }
  await instanceConfig.load();
  const active = instanceConfig.getActiveInstance();
  if (active?.rootDir) {
    return path.resolve(active.rootDir);
  }
  if (active?.modsDir) {
    return path.resolve(path.dirname(active.modsDir));
  }
  return null;
}

function renderProfilesNote(
  title: string,
  containerDir: string,
  activeInfo: any,
  profiles: any[],
): void {
  if (profiles.length === 0) {
    p.note(
      pc.dim(`Belum ada profil modpack tersimpan di wadah ${path.basename(containerDir)}.\nLokasi: ${containerDir}`),
      title,
    );
    return;
  }

  const lines = profiles.map((pr) => {
    const statusBadge = pr.isActive ? pc.green(" [AKTIF]") : pc.dim(" [Tersimpan]");
    const dateStr = new Date(pr.updatedAt).toLocaleString();
    return `• ${pc.bold(pc.cyan(pr.name))} (${pc.white(pr.id)})${statusBadge}\n  Versi: ${pr.versionId} | Loader: ${pr.loader ?? "-"} ${pr.gameVersion ?? "-"} | File: ${pr.filesCount} berkas\n  Terakhir: ${dateStr}`;
  });

  const headerTitle = activeInfo?.activeProfile
    ? `${title} (${profiles.length} Profil) — Aktif: ${activeInfo.name ?? activeInfo.activeProfile}`
    : `${title} (${profiles.length} Profil) — Status: [BERSIH / NON-AKTIF]`;

  p.note(lines.join("\n\n"), headerTitle);
}

export async function modpackListProfilesCommand(opts?: {dir?: string}): Promise<void> {
  showBanner();
  const instanceDir = await resolveInstanceDir(opts?.dir);
  if (!instanceDir) {
    p.log.error('Folder instance belum ditentukan. Jalankan "lm init" terlebih dahulu.');
    process.exitCode = 1;
    return;
  }

  if (opts?.dir) {
    await ModpackProfileManager.syncProfilesFromDownloads(instanceDir);
    const activeInfo = await ModpackProfileManager.getActiveProfile(instanceDir);
    const profiles = await ModpackProfileManager.listProfiles(instanceDir);
    renderProfilesNote(path.basename(instanceDir), instanceDir, activeInfo, profiles);
    return;
  }

  const containers = await ModpackProfileManager.discoverClientContainers(instanceDir);
  if (containers.length === 0) {
    await ModpackProfileManager.syncProfilesFromDownloads(instanceDir);
    const activeInfo = await ModpackProfileManager.getActiveProfile(instanceDir);
    const profiles = await ModpackProfileManager.listProfiles(instanceDir);
    renderProfilesNote(path.basename(instanceDir), instanceDir, activeInfo, profiles);
    return;
  }

  for (const c of containers) {
    await ModpackProfileManager.syncProfilesFromDownloads(c.containerDir);
    const activeInfo = await ModpackProfileManager.getActiveProfile(c.containerDir);
    const profiles = await ModpackProfileManager.listProfiles(c.containerDir);
    renderProfilesNote(
      `Client ${c.loader.toUpperCase()} (${c.containerName})`,
      c.containerDir,
      activeInfo,
      profiles,
    );
  }

  p.log.message(
    pc.dim("Gunakan perintah berikut untuk beralih modpack: ") +
      pc.cyan("lm modpack switch <id>"),
  );
}

export async function modpackSwitchCommand(
  profileId?: string,
  opts?: {dir?: string},
): Promise<void> {
  showBanner();
  const instanceDir = await resolveInstanceDir(opts?.dir);
  if (!instanceDir) {
    p.log.error('Folder instance belum ditentukan. Jalankan "lm init" terlebih dahulu.');
    process.exitCode = 1;
    return;
  }

  let targetContainerDir = instanceDir;
  if (!opts?.dir) {
    const containers = await ModpackProfileManager.discoverClientContainers(instanceDir);
    if (containers.length > 0) {
      if (profileId) {
        for (const c of containers) {
          const list = await ModpackProfileManager.listProfiles(c.containerDir);
          if (list.some((p) => p.id === profileId)) {
            targetContainerDir = c.containerDir;
            break;
          }
        }
      } else if (process.stdin.isTTY && containers.length > 1) {
        const clientPick = await p.select({
          message: "Pilih client modpack:",
          options: containers.map((c) => ({
            value: c.containerDir,
            label: `Client ${c.loader.toUpperCase()} (${c.containerName})`,
            hint: `${c.profilesCount} profil tersimpan`,
          })),
        });
        exitIfCancel(clientPick);
        targetContainerDir = clientPick as string;
      } else {
        targetContainerDir = containers[0].containerDir;
      }
    }
  }

  await ModpackProfileManager.syncProfilesFromDownloads(targetContainerDir);
  const profiles = await ModpackProfileManager.listProfiles(targetContainerDir);
  if (profiles.length === 0) {
    p.log.error("Tidak ada profil modpack yang tersimpan untuk dialihkan pada wadah ini.");
    process.exitCode = 1;
    return;
  }

  let targetId = profileId;
  if (!targetId) {
    if (process.stdin.isTTY) {
      const choice = await p.select({
        message: "Pilih modpack yang ingin diaktifkan:",
        options: profiles.map((pr) => ({
          value: pr.id,
          label: `${pr.name}${pr.isActive ? " (Sedang Aktif)" : ""}`,
          hint: `${pr.loader ?? ""} ${pr.gameVersion ?? ""} • ${pr.filesCount} berkas`,
        })),
      });
      exitIfCancel(choice);
      targetId = choice as string;
    } else {
      targetId = profiles[0].id;
    }
  }

  const s = p.spinner();
  s.start(`Mengalihkan wadah ke profil "${targetId}"...`);
  try {
    const activated = await ModpackProfileManager.activateProfile(targetContainerDir, targetId);

    const cName = path.basename(targetContainerDir);
    const instanceKey = `tlauncher-${cName.toLowerCase()}`;
    instanceConfig.saveInstance(
      instanceKey,
      {
        name: `TLauncher: ${cName}`,
        launcher: "TLauncher",
        rootDir: targetContainerDir,
        modsDir: path.join(targetContainerDir, "mods"),
        gameVersion: activated.gameVersion ?? "1.20.1",
        loader: (activated.loader as any) ?? "fabric",
      },
      true,
    );
    await instanceConfig.save();

    s.stop(
      pc.green(
        `Modpack "${activated.name}" (${activated.versionId}) sekarang AKTIF di ${cName}!`,
      ),
    );
  } catch (err: any) {
    s.stop(pc.red(`Gagal mengalihkan profil: ${err.message}`));
    process.exitCode = 1;
  }
}

export async function modpackDisableCommand(opts?: {dir?: string}): Promise<void> {
  showBanner();
  const instanceDir = await resolveInstanceDir(opts?.dir);
  if (!instanceDir) {
    p.log.error('Folder instance belum ditentukan. Jalankan "lm init" terlebih dahulu.');
    process.exitCode = 1;
    return;
  }

  // Jika opsi --dir diberikan secara spesifik, bersihkan hanya wadah tersebut
  if (opts?.dir) {
    const activeInfo = await ModpackProfileManager.getActiveProfile(instanceDir);
    if (!activeInfo || !activeInfo.activeProfile) {
      p.log.info("Wadah saat ini sudah dalam kondisi NON-AKTIF (bersih/vanilla).");
      return;
    }

    const s = p.spinner();
    s.start(`Menonaktifkan modpack aktif dan membersihkan wadah...`);
    try {
      const disabledName = await ModpackProfileManager.disableProfile(instanceDir);
      s.stop(
        pc.green(
          `Wadah berhasil dinonaktifkan! (${disabledName ?? "Modpack"} telah diarsipkan dengan aman)`,
        ),
      );
      p.log.message(
        pc.dim("Folder wadah sekarang bersih total. Buka game untuk bermain tanpa modpack.\n") +
          pc.dim("Untuk mengaktifkan kembali, jalankan: ") +
          pc.cyan(`lm modpack enable ${activeInfo.activeProfile}`),
      );
    } catch (err: any) {
      s.stop(pc.red(`Gagal menonaktifkan modpack: ${err.message}`));
      process.exitCode = 1;
    }
    return;
  }

  // Jika tanpa --dir, nonaktifkan dan bersihkan SELURUH wadah modpack sekaligus
  const s = p.spinner();
  s.start("Menonaktifkan seluruh modpack dan membersihkan semua wadah mypack...");
  try {
    const results = await ModpackProfileManager.disableAllModpackContainers(instanceDir);
    s.stop(pc.green("Semua wadah mypack berhasil dinonaktifkan dan dibersihkan total!"));

    for (const res of results) {
      if (res.disabledProfile) {
        p.log.info(`[${pc.bold(res.containerName)}] Profil "${res.disabledProfile}" berhasil disimpan ke arsip.`);
      } else {
        p.log.message(pc.dim(`• [${res.containerName}] Sudah dalam kondisi bersih.`));
      }
    }

    p.log.message(
      pc.dim("\nSemua wadah sekarang bersih total (hanya menyisakan berkas mesin TLauncher).\n") +
        pc.dim("Untuk mengaktifkan kembali modpack, pilih client lewat menu TUI (lm) atau gunakan ") +
        pc.cyan("lm modpack switch <id>"),
    );
  } catch (err: any) {
    s.stop(pc.red(`Gagal menonaktifkan modpack: ${err.message}`));
    process.exitCode = 1;
  }
}

export async function modpackEnableCommand(
  profileId?: string,
  opts?: {dir?: string},
): Promise<void> {
  await modpackSwitchCommand(profileId, opts);
}

export async function modpackRemoveCommand(
  profileId: string,
  opts?: {dir?: string; yes?: boolean},
): Promise<void> {
  showBanner();
  const instanceDir = await resolveInstanceDir(opts?.dir);
  if (!instanceDir) {
    p.log.error('Folder instance belum ditentukan. Jalankan "lm init" terlebih dahulu.');
    process.exitCode = 1;
    return;
  }

  if (!opts?.yes && process.stdin.isTTY) {
    const confirmed = await p.confirm({
      message: `Hapus profil modpack "${profileId}" secara permanen dari penyimpanan?`,
      initialValue: false,
    });
    exitIfCancel(confirmed);
    if (!confirmed) {
      p.log.info("Penghapusan dibatalkan.");
      return;
    }
  }

  const s = p.spinner();
  s.start(`Menghapus profil "${profileId}"...`);
  try {
    await ModpackProfileManager.removeProfile(instanceDir, profileId);
    s.stop(pc.green(`Profil "${profileId}" berhasil dihapus.`));
  } catch (err: any) {
    s.stop(pc.red(`Gagal menghapus profil: ${err.message}`));
    process.exitCode = 1;
  }
}
