import {readdir, stat} from "node:fs/promises";
import path from "node:path";
import {showBanner, renderInstanceHeader, printFAQ, clearScreen} from "../theme.js";
import {askInteractiveMenu, ask, type InteractiveChoice} from "../interactive.js";
import {instanceConfig} from "../../core/instance/config.js";
import {runInteractiveBrowser} from "./browser.js";
import {runInteractiveManager} from "./manager.js";
import {updateCommand} from "../../commands/update.js";
import {initCommand} from "../../commands/init.js";
import {bisectCommand} from "../../commands/bisect.js";
import {runInteractiveProfileSwitcher} from "./profileSwitcher.js";
import {DependencyGraph} from "../../core/dependency/graph.js";
import {ModsWatcher} from "../../core/watcher/modsWatcher.js";
import {formatBytes} from "../../utils/format.js";

interface CachedInstanceStats {
  dir: string;
  timestamp: number;
  data: {modsCount: number; activeCount: number; storageUsage: string};
}
let statsCache: CachedInstanceStats | null = null;

async function getInstanceStats(modsDir?: string, forceRefresh = false) {
  if (!modsDir) return {modsCount: 0, activeCount: 0, storageUsage: "0 B"};

  const now = Date.now();
  if (!forceRefresh && statsCache && statsCache.dir === modsDir && now - statsCache.timestamp < 3000) {
    return statsCache.data;
  }

  try {
    const files = await readdir(modsDir);
    const modFiles = files.filter((f) => f.endsWith(".jar") || f.endsWith(".jar.disabled"));
    const activeCount = modFiles.filter((f) => !f.endsWith(".disabled")).length;

    const statsResults = await Promise.all(
      modFiles.map((f) => stat(path.join(modsDir, f)).catch(() => null)),
    );

    let totalBytes = 0;
    for (const s of statsResults) {
      if (s) totalBytes += s.size;
    }

    const data = {
      modsCount: modFiles.length,
      activeCount,
      storageUsage: formatBytes(totalBytes),
    };

    statsCache = {dir: modsDir, timestamp: now, data};
    return data;
  } catch {
    return {modsCount: 0, activeCount: 0, storageUsage: "0 B"};
  }
}

export async function launchHomeDashboard(): Promise<void> {
  let isRunning = true;
  let activeWatcher: ModsWatcher | null = null;
  let lastWatchedModsDir = "";
  let lastReconcileTime = 0;

  const cleanupWatcher = () => {
    if (activeWatcher) {
      activeWatcher.stop();
      activeWatcher = null;
    }
  };

  try {
    while (isRunning) {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      const now = Date.now();

      if (active?.modsDir) {
        const instanceDir = active.rootDir ?? path.dirname(active.modsDir);
        if (active.modsDir !== lastWatchedModsDir || now - lastReconcileTime > 3000) {
          const graph = new DependencyGraph(instanceDir);
          await graph.load();
          await graph.reconcileWithDisk(active.modsDir);
          lastReconcileTime = now;
        }

        if (active.modsDir !== lastWatchedModsDir) {
          cleanupWatcher();
          activeWatcher = new ModsWatcher(active.modsDir, instanceDir);
          activeWatcher.start();
          lastWatchedModsDir = active.modsDir;
        }
      }

      const stats = await getInstanceStats(active?.modsDir);

      const homeChoices: InteractiveChoice[] = [
        {name: "EKSPLORASI & PENCARIAN", value: "sep"},
        {
          name: "🔍  Cari & Eksplorasi Konten Modrinth",
          value: "search",
          hint: "Pencarian kustom & filter lengkap",
        },
        {name: "⭐  Mod Esensial & Populer", value: "popular", hint: "Sodium, Iris, Lithium, dll."},
        {name: "📦  Jelajahi Modpack Populer", value: "modpacks", hint: ".mrpack siap pakai"},
        {name: "✨  Jelajahi Shader Pack", value: "shaders", hint: "Efek pencahayaan & visual"},
        {name: "🎨  Jelajahi Resource Pack", value: "resourcepacks", hint: "Tekstur & GUI kustom"},

        {name: "MANAJEMEN INSTANCE", value: "sep"},
        {
          name: "🗃️   Kelola Mod Terpasang",
          value: "manage",
          hint: `${stats.modsCount} berkas (${stats.activeCount} aktif)`,
        },
        {name: "🔄  Periksa & Update Mod", value: "update", hint: "Deteksi versi rilis baru"},
        {
          name: "⚙️   Kelola Profil & Versi Game",
          value: "switch_instance",
          hint: `${active?.loader ?? "-"} ${active?.gameVersion ?? "-"} (Snapshot & Switch)`,
        },

        {name: "ALAT & PANDUAN", value: "sep"},
        {
          name: "🩺  Diagnostik Crash & Bisect Tool",
          value: "bisect",
          hint: "Cari mod penyebab crash",
        },
        {name: "❓  Pusat Bantuan & Panduan", value: "faq", hint: "Dokumentasi & troubleshooting"},

        {name: "──────────────────", value: "sep"},
        {name: "[Keluar dari LoadModer]", value: "exit"},
      ];

      const selected = await askInteractiveMenu(
        "DASHBOARD UTAMA",
        homeChoices,
        () => {
          showBanner(active?.name, false, false);
          renderInstanceHeader({
            instanceName: active?.name,
            gameVersion: active?.gameVersion,
            loader: active?.loader,
            modsCount: stats.modsCount,
            activeCount: stats.activeCount,
            storageUsage: stats.storageUsage,
          });
        },
        {
          allowBackOnCancel: false,
        },
      );

      switch (selected) {
        case "search": {
          clearScreen();
          showBanner(active?.name, true);
          const query = await ask("Ketik kata kunci pencarian (kosongkan untuk jelajahi semua):");
          await runInteractiveBrowser(active, query?.trim() ?? "", "mod");
          break;
        }

        case "popular": {
          await runInteractiveBrowser(active, "", "mod");
          break;
        }

        case "modpacks": {
          await runInteractiveBrowser(active, "", "modpack");
          break;
        }

        case "shaders": {
          await runInteractiveBrowser(active, "", "shader");
          break;
        }

        case "resourcepacks": {
          await runInteractiveBrowser(active, "", "resourcepack");
          break;
        }

        case "manage": {
          await runInteractiveManager(active);
          break;
        }

        case "update": {
          clearScreen();
          showBanner(active?.name, true);
          await updateCommand({
            dir: active?.modsDir,
            mcVersion: active?.gameVersion,
            loader: active?.loader,
            skipBanner: true,
          });
          await ask("Tekan Enter untuk kembali ke dashboard...");
          break;
        }

        case "switch_instance": {
          cleanupWatcher();
          await runInteractiveProfileSwitcher();
          break;
        }

        case "bisect": {
          clearScreen();
          showBanner(active?.name, true);
          const bisectChoice = await askInteractiveMenu(
            "SESI BISECT TROUBLESHOOTING",
            [
              {name: "1. Mulai Sesi Bisect (Nonaktifkan 50% mod kandidat)", value: "start"},
              {name: "2. Lapor: Game BERHASIL Terbuka (Good step)", value: "good"},
              {name: "3. Lapor: Game MASIH Crash (Bad step)", value: "bad"},
              {name: "4. Reset / Kembalikan Seluruh Mod ke Aktif", value: "reset"},
              {name: "──────────────────", value: "sep"},
              {name: "[Kembali ke Dashboard]", value: "back"},
            ],
            () => showBanner(active?.name, true),
          );

          if (bisectChoice && bisectChoice !== "back" && bisectChoice !== "sep") {
            await bisectCommand(bisectChoice, {dir: active?.modsDir, skipBanner: true});
            await ask("Tekan Enter untuk kembali ke dashboard...");
          }
          break;
        }

        case "faq": {
          clearScreen();
          showBanner(active?.name, true);
          printFAQ();
          await ask("Tekan Enter untuk kembali ke dashboard...");
          break;
        }

        case "exit": {
          clearScreen();
          console.log("Sampai jumpa! Terima kasih telah menggunakan LoadModer.\n");
          isRunning = false;
          break;
        }
      }
    }
  } finally {
    cleanupWatcher();
  }
}
