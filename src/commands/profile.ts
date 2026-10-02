import path from "node:path";
import {readdir} from "node:fs/promises";
import {p, pc, showBanner, clearScreen} from "../ui/prompts.js";
import {
  askInteractiveMenu,
  ask,
  getMinecraftVersionChoices,
  type InteractiveChoice,
} from "../ui/interactive.js";
import {instanceConfig} from "../core/instance/config.js";
import {profileSnapshotManager} from "../core/profile/snapshotManager.js";
import {SUPPORTED_LOADERS, type SupportedLoader} from "../constants.js";
import type {SavedInstanceConfig} from "../types/instance.js";
import {initCommand} from "./init.js";

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
      {
        name: "🎮  Ganti ke Instance Launcher Lain",
        value: "change_instance",
        hint: "Prism, Vanilla, MultiMC, CurseForge",
      },
      {name: "──────────────────", value: "sep"},
      {name: "[Kembali ke Dashboard Utama]", value: "back"},
    ];

    const selected = await askInteractiveMenu(
      `KELOLA PROFIL & VERSI: ${instance.name.toUpperCase()}`,
      choices,
      () => {
        showBanner(
          instance.name,
          true,
          false,
          `${instance.loader?.toUpperCase() ?? "-"} ${instance.gameVersion ?? "-"}`,
        );
      },
    );

    if (!selected || selected === "back" || selected === "sep") {
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

      case "change_instance": {
        await initCommand();
        return;
      }
    }
  }
}

async function handleSwitchFlow(
  instanceKey: string,
  instance: SavedInstanceConfig,
  currentModsCount: number,
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
      name: `${isCurrent ? "● " : "  "}${s.loader.toUpperCase()} ${s.gameVersion} (${s.modsCount} mod)`,
      value: s.snapshotId,
      hint: isCurrent
        ? "SEDANG AKTIF"
        : `Diperbarui: ${new Date(s.updatedAt).toLocaleDateString()}`,
    };
  });

  choices.push({name: "──────────────────", value: "sep"});
  choices.push({name: "[Kembali]", value: "back"});

  const chosenSnapshotId = await askInteractiveMenu("DAFTAR SNAPSHOT TERSIMPAN", choices, () =>
    showBanner(instance.name, true),
  );
  if (!chosenSnapshotId || chosenSnapshotId === "back" || chosenSnapshotId === "sep") return;

  const targetSnapshot = snapshots.find((s) => s.snapshotId === chosenSnapshotId);
  if (!targetSnapshot) return;

  const subChoices: InteractiveChoice[] = [
    {name: "▶️  Terapkan & Switch ke Snapshot ini Sekarang", value: "apply"},
    {name: "👁️  Lihat Daftar Mod dalam Snapshot", value: "view"},
    {name: "🗑️  Hapus Snapshot ini", value: "delete"},
    {name: "──────────────────", value: "sep"},
    {name: "[Kembali]", value: "back"},
  ];

  const subSelected = await askInteractiveMenu(
    `SNAPSHOT: ${targetSnapshot.loader.toUpperCase()} ${targetSnapshot.gameVersion}`,
    subChoices,
    () => showBanner(instance.name, true),
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

export async function profileListCommand(): Promise<void> {
  showBanner();
  await instanceConfig.load();
  const active = instanceConfig.getActiveInstance();
  if (!active) {
    p.log.error("Tidak ada instance aktif.");
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
  }
}
