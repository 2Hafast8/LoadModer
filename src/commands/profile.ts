import {p, pc, showBanner} from "../ui/prompts.js";
import {instanceConfig} from "../core/instance/config.js";
import {profileSnapshotManager} from "../core/profile/snapshotManager.js";
import {runInteractiveProfileSwitcher} from "../ui/dashboard/profileSwitcher.js";

export {runInteractiveProfileSwitcher};

export async function profileListCommand(): Promise<void> {
  showBanner();
  await instanceConfig.load();
  const active = instanceConfig.getActiveInstance();
  if (!active) {
    p.log.error("Tidak ada instance aktif.");
    process.exitCode = 1;
    return;
  }

  const snapshots = await profileSnapshotManager.listSnapshots(active);
  if (snapshots.length === 0) {
    p.log.info(pc.yellow("Belum ada snapshot yang tersimpan."));
    return;
  }

  p.note(
    snapshots
      .map(
        (s) =>
          `• ${pc.bold(s.loader.toUpperCase())} ${pc.bold(s.gameVersion)}: ${s.modsCount} mod (Diperbarui: ${new Date(s.updatedAt).toLocaleString()})`,
      )
      .join("\n"),
    `Daftar Snapshot Profil (${active.name})`,
  );
}

export async function profileSwitchCommand(loader?: string, version?: string): Promise<void> {
  await instanceConfig.load();
  const cfg = instanceConfig.get();
  const activeKey = cfg.activeInstance;

  if (!activeKey || !cfg.instances[activeKey]) {
    p.log.error("Tidak ada instance aktif yang dipilih.");
    process.exitCode = 1;
    return;
  }

  if (!loader && !version) {
    await runInteractiveProfileSwitcher(activeKey);
    return;
  }

  const active = cfg.instances[activeKey];
  const targetLoader = loader || active.loader || "fabric";
  const targetVersion = version || active.gameVersion || "1.21.1";

  const s = p.spinner();
  s.start(`Mengalihkan profil instance ke ${targetLoader} ${targetVersion}...`);

  try {
    const res = await profileSnapshotManager.switchProfile(activeKey, targetLoader, targetVersion);
    s.stop(pc.green("Pengalihan profil berhasil!"));
    p.note(
      `Instance       : ${active.name}\n` +
        `Loader         : ${targetLoader}\n` +
        `Minecraft      : ${targetVersion}\n` +
        `Arsip Lama     : ${res.savedCount} mod dipindahkan ke snapshot\n` +
        `Mod Dipulihkan : ${res.restoredCount} mod`,
      "Status Profil",
    );
  } catch (err: any) {
    s.stop(pc.red("Gagal mengalihkan profil."));
    p.log.error(err.message);
    process.exitCode = 1;
  }
}
