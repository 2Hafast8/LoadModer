import { instanceConfig } from '../core/instance/config.js';
import { BisectRunner } from '../core/troubleshoot/bisect.js';
import { p, pc, showBanner } from '../ui/prompts.js';

interface BisectOptions {
  dir?: string;
  skipBanner?: boolean;
}

export async function bisectCommand(subcommand: string, opts: BisectOptions) {
  if (!opts.skipBanner) {
    showBanner();
  }
  await instanceConfig.load();
  const activeInst = instanceConfig.getActiveInstance();

  const modsDir = opts.dir ?? activeInst?.modsDir;
  if (!modsDir) {
    p.log.error('Folder mods belum ditentukan. Jalankan "loadmoder init" terlebih dahulu.');
    process.exit(1);
  }

  const runner = new BisectRunner(modsDir);

  switch (subcommand) {
    case 'start': {
      try {
        const { totalMods, testingCount } = await runner.start();
        p.log.step(
          `Sesi Bisect Dimulai! Total mod: ${totalMods}. Sebanyak ${testingCount} mod dinonaktifkan sementara.`
        );
        p.note(
          '1. Jalankan Minecraft sekarang.\n' +
            '2. Jika game BISA dibuka tanpa crash: ketik "lm bisect good"\n' +
            '3. Jika game MASIH crash: ketik "lm bisect bad"',
          'Petunjuk Pengujian'
        );
        p.outro(pc.cyan('Silakan uji game Anda...'));
      } catch (err) {
        p.log.error((err as Error).message);
        process.exitCode = 1;
      }
      break;
    }

    case 'good':
    case 'bad': {
      try {
        const res = await runner.report(subcommand);
        if (res.finished) {
          p.note(
            `Mod penyebab crash berhasil diisolasi:\n${pc.bold(pc.red(res.culprit!))}`,
            '🎯 MOD PENYEBAB CRASH TERDETEKSI'
          );
          p.log.info(`Gunakan "lm disable ${res.culprit}" atau hapus mod tersebut.`);
          p.outro(pc.green('Sesi bisect selesai, mod lainnya telah diaktifkan kembali.'));
        } else {
          p.log.step(`Langkah #${res.step}: Tersisa ${res.remaining} mod kandidat.`);
          p.note(
            'Buka kembali game Minecraft Anda, lalu ketik:\n"lm bisect good" atau "lm bisect bad"',
            'Langkah Pengujian Berikutnya'
          );
          p.outro(pc.cyan('Menunggu pengujian berikutnya...'));
        }
      } catch (err) {
        p.log.error((err as Error).message);
        process.exitCode = 1;
      }
      break;
    }

    case 'reset': {
      await runner.reset();
      p.outro(pc.green('Sesi bisect dihentikan. Seluruh mod dikembalikan ke status aktif.'));
      break;
    }

    default: {
      p.log.error(`Sub-perintah "${subcommand}" tidak dikenal. Gunakan: start | good | bad | reset`);
      process.exitCode = 1;
      break;
    }
  }
}
