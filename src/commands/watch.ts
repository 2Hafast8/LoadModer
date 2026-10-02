import path from "node:path";
import {stat} from "node:fs/promises";
import chalk from "chalk";
import boxen from "boxen";
import {instanceConfig} from "../core/instance/config.js";
import {
  ModsWatcher,
  type WatcherFileEvent,
  type WatcherSyncEvent,
} from "../core/watcher/modsWatcher.js";
import {theme, clearScreen, showBanner, logger} from "../ui/theme.js";
import {p} from "../ui/prompts.js";

interface WatchOptions {
  dir?: string;
}

export async function watchCommand(opts: WatchOptions): Promise<void> {
  await instanceConfig.load();
  const activeInst = instanceConfig.getActiveInstance();

  const modsDir = opts.dir ?? activeInst?.modsDir;
  if (!modsDir) {
    p.log.error('Folder mods belum ditentukan. Jalankan "loadmoder init" terlebih dahulu.');
    process.exit(1);
  }

  const instanceDir = activeInst?.rootDir ?? path.dirname(modsDir);

  clearScreen();
  showBanner(activeInst?.name, true);

  const bannerText =
    chalk.hex(theme.text).bold("👁️  LOADMODER REAL-TIME MODS WATCHER\n") +
    chalk.hex(theme.textMuted)("Folder Dipantau: ") +
    chalk.hex(theme.primary)(modsDir) +
    "\n" +
    chalk.hex(theme.muted)("Tekan Ctrl+C untuk menghentikan pemantauan.");

  console.log(
    boxen(bannerText, {
      padding: {top: 0, bottom: 0, left: 2, right: 2},
      margin: {top: 0, bottom: 1, left: 0, right: 0},
      borderStyle: "round",
      borderColor: theme.primary,
    }),
  );

  const watcher = new ModsWatcher(modsDir, instanceDir);

  logger.info(
    chalk.hex(theme.textMuted)("Melakukan pengecekan dan sinkronisasi awal dengan disk..."),
  );
  const initialSync = await watcher.sync();
  if (initialSync.unregistered.length > 0) {
    logger.warn(
      chalk.hex(theme.warning)(
        `Ditemukan ${initialSync.unregistered.length} mod yang sudah tidak ada di disk. Lockfile telah disinkronkan.`,
      ),
    );
  } else {
    logger.success("Semua berkas di folder mods cocok dengan loadmoder.lock.json.");
  }

  logger.br();
  console.log(
    chalk.hex(theme.info)("  ● ") +
      chalk.hex(theme.textMuted)("Menunggu perubahan berkas mod...\n"),
  );

  watcher.on("file-event", async (e: WatcherFileEvent) => {
    const fullPath = path.join(modsDir, e.filename);
    let exists = false;
    try {
      await stat(fullPath);
      exists = true;
    } catch {}

    const timePrefix = chalk.hex(theme.muted)(`[${e.timestamp}] `);

    if (!exists) {
      console.log(
        timePrefix +
          chalk.hex(theme.error).bold("🗑️  Berkas Dihapus: ") +
          chalk.hex(theme.text)(e.filename),
      );
    } else {
      console.log(
        timePrefix +
          chalk.hex(theme.success).bold("📥 Berkas Ditambahkan/Diubah: ") +
          chalk.hex(theme.text)(e.filename),
      );
    }
  });

  watcher.on("sync", (e: WatcherSyncEvent) => {
    const timePrefix = chalk.hex(theme.muted)(`[${e.timestamp}] `);
    console.log(
      timePrefix +
        chalk.hex(theme.primary).bold("🔄 Auto-Sync: ") +
        chalk.hex(theme.textMuted)(
          `${e.unregistered.length} mod dihapus dari lockfile. Dependensi yatim diperbarui.`,
        ),
    );
  });

  watcher.on("error", (err) => {
    logger.error(`Terjadi kesalahan pada watcher: ${(err as Error).message}`);
  });

  watcher.start();

  const onExit = () => {
    watcher.stop();
    console.log(chalk.hex(theme.muted)("\nPemantauan folder mods dihentikan.\n"));
    process.exit(0);
  };

  process.on("SIGINT", onExit);
  process.on("SIGTERM", onExit);

  await new Promise(() => {});
}
