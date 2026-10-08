import {existsSync} from "node:fs";
import {readdir, stat} from "node:fs/promises";
import path from "node:path";
import {
  renderCommandCenterHeader,
  formatBadge,
  showBanner,
  printFAQ,
  clearScreen,
} from "../theme.js";
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
import {ModpackProfileManager} from "../../core/modpack/profileManager.js";
import {runInteractiveModpackProfileManager} from "./modpackProfileManager.js";
import {getLauncherCapabilities} from "../../core/instance/capabilities.js";
import {instanceDetector} from "../../core/instance/detector.js";

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
      let active = instanceConfig.getActiveInstance();

      // Jika belum ada activeInstance (pertama kali memakai LoadModer), inisialisasi Official Minecraft default
      if (!active) {
        const defaultVanilla = await instanceDetector.getDefaultVanillaInstance();
        instanceConfig.saveInstance(
          defaultVanilla.id,
          {
            name: defaultVanilla.name,
            launcher: defaultVanilla.launcher,
            rootDir: defaultVanilla.rootDir,
            modsDir: defaultVanilla.modsDir,
            gameVersion: defaultVanilla.gameVersion ?? "1.21.1",
            loader: defaultVanilla.loader ?? "fabric",
            mode: "default",
          },
          true,
        );
        await instanceConfig.save();
      }
      const now = Date.now();

      if (active?.modsDir) {
        const instanceDir = active.rootDir ?? path.dirname(active.modsDir);
        if (active.modsDir !== lastWatchedModsDir || now - lastReconcileTime > 3000) {
          const graph = new DependencyGraph(instanceDir);
          await graph.load();
          await graph.reconcileWithDisk(active.modsDir);
          lastReconcileTime = now;
        }

        const shouldWatch = existsSync(active.modsDir);
        if (active.modsDir !== lastWatchedModsDir || (shouldWatch && !activeWatcher?.running)) {
          cleanupWatcher();
          if (shouldWatch) {
            activeWatcher = new ModsWatcher(active.modsDir, instanceDir);
            activeWatcher.on("error", () => {});
            activeWatcher.start();
          }
          lastWatchedModsDir = active.modsDir;
        }
      }

      const containerDir = active?.rootDir ?? (active?.modsDir ? path.dirname(active.modsDir) : "");
      let activeModpack = containerDir ? await ModpackProfileManager.getActiveProfile(containerDir) : null;
      if (!activeModpack && containerDir) {
        try {
          const containers = await ModpackProfileManager.discoverClientContainers(containerDir);
          const anyActive = containers.find((c) => c.activeProfileName);
          if (anyActive) {
            activeModpack = {
              activeProfile: anyActive.activeProfileName,
              name: anyActive.activeProfileName ?? undefined,
              versionId: "",
              loader: anyActive.loader,
              gameVersion: anyActive.gameVersion,
              updatedAt: new Date().toISOString(),
            };
          }
        } catch {}
      }
      const stats = await getInstanceStats(active?.modsDir);

      const caps = getLauncherCapabilities(active?.launcher);

      const explorationChoices: InteractiveChoice[] = [
        {
          name: "🔍  Cari & Eksplorasi Konten Modrinth",
          value: "search",
          hint: "Pencarian kustom dengan filter tags, loader, dan versi game",
          badge: formatBadge("Modrinth", "info"),
        },
        {
          name: "⭐  Mod Esensial & Populer",
          value: "popular",
          hint: "Sodium, Iris, Lithium, Fabric API, dan mod esensial performa",
        },
      ];

      if (caps.supportsModpack) {
        explorationChoices.push({
          name: "📦  Jelajahi & Unduh Modpack",
          value: "modpacks",
          hint: "Jelajahi dan pasang paket mod Modrinth (.mrpack) ke wadah aktif",
          badge: formatBadge("Modpack", "primary"),
        });
      }

      explorationChoices.push(
        {
          name: "✨  Jelajahi Shader Pack",
          value: "shaders",
          hint: "Efek pencahayaan dan grafis realistis",
        },
        {
          name: "🎨  Jelajahi Resource Pack",
          value: "resourcepacks",
          hint: "Tekstur kustom, UI, dan paket audio",
        },
      );

      const managementChoices: InteractiveChoice[] = [
        {
          name: "🗃️   Kelola Mod Terpasang",
          value: "manage",
          hint: `${stats.modsCount} berkas (${stats.activeCount} aktif) • ${stats.storageUsage}`,
          badge: formatBadge(
            `${stats.activeCount} mod`,
            stats.activeCount > 0 ? "success" : "muted",
          ),
        },
        {
          name: "🔄  Periksa & Update Mod",
          value: "update",
          hint: "Deteksi rilis pembaruan baru di Modrinth",
          badge: formatBadge("Periksa", "primary"),
        },
      ];

      if (caps.supportsContainers) {
        managementChoices.push({
          name: `📦  Brankas Profil Modpack (${active?.launcher ?? "TLauncher"})`,
          value: "modpack_profiles",
          hint: activeModpack?.activeProfile
            ? `Aktif: ${activeModpack.name ?? activeModpack.activeProfile} (${active?.loader?.toUpperCase() ?? "CLIENT"}) • Beralih atau kelola profil`
            : "Wadah bersih (Vanilla) • Pilih client untuk bermain atau pasang modpack",
          badge: activeModpack?.activeProfile
            ? formatBadge(activeModpack.name ?? "Modpack", "success")
            : formatBadge("Clean State", "muted"),
        });
      }

      managementChoices.push({
        name: "⚙️   Kelola Profil & Versi Game",
        value: "switch_instance",
        hint: `Instance: ${active?.name ?? "Default"} (${active?.loader ?? "-"} ${active?.gameVersion ?? "-"})`,
        badge: active?.loader
          ? formatBadge(`${active.loader} ${active.gameVersion ?? ""}`.trim(), "secondary")
          : undefined,
      });

      const homeChoices: InteractiveChoice[] = [
        {name: "EKSPLORASI & PENCARIAN", value: "sep"},
        ...explorationChoices,
        {name: "MANAJEMEN INSTANCE", value: "sep"},
        ...managementChoices,

        {name: "ALAT & PANDUAN", value: "sep"},
        {
          name: "🩺  Diagnostik Crash & Bisect Tool",
          value: "bisect",
          hint: "Cari mod penyebab crash via binary search otomatis",
          badge: formatBadge("Bisect", "warning"),
        },
        {
          name: "❓  Pusat Bantuan & Panduan",
          value: "faq",
          hint: "Dokumentasi perintah CLI, tips performa, & FAQ",
        },

        {name: "──────────────────", value: "sep"},
        {name: "[Keluar dari LoadModer]", value: "exit"},
      ];

      const selected = await askInteractiveMenu(
        "DASHBOARD UTAMA",
        homeChoices,
        () => {
          renderCommandCenterHeader({
            instanceName: active?.name,
            gameVersion: active?.gameVersion,
            loader: active?.loader,
            mode: active?.mode ?? "default",
            activeContainer: active?.activeContainer,
            supportsModeSwitch: caps.supportsModeSwitch,
            modsCount: stats.modsCount,
            activeCount: stats.activeCount,
            storageUsage: stats.storageUsage,
            statusText: caps.supportsContainers
              ? (activeModpack?.activeProfile
                  ? `● Modpack: ${activeModpack.name ?? activeModpack.activeProfile}`
                  : "● Siap (Clean State)")
              : "● Siap",
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
          clearScreen();
          await runInteractiveBrowser(active, "", "mod");
          break;
        }

        case "modpacks": {
          clearScreen();
          await runInteractiveBrowser(active, "", "modpack");
          break;
        }

        case "shaders": {
          clearScreen();
          await runInteractiveBrowser(active, "", "shader");
          break;
        }

        case "resourcepacks": {
          clearScreen();
          await runInteractiveBrowser(active, "", "resourcepack");
          break;
        }

        case "manage": {
          clearScreen();
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

        case "modpack_profiles": {
          clearScreen();
          await runInteractiveModpackProfileManager();
          break;
        }

        case "switch_instance": {
          clearScreen();
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
