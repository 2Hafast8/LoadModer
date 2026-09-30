#!/usr/bin/env node
import { Command } from 'commander';
import { APP_NAME, APP_VERSION } from './constants.js';
import { initCommand } from './commands/init.js';
import { searchCommand } from './commands/search.js';
import { installCommand } from './commands/install.js';
import { listCommand } from './commands/list.js';
import { updateCommand } from './commands/update.js';
import { removeCommand } from './commands/remove.js';
import { toggleCommand } from './commands/toggle.js';
import { bisectCommand } from './commands/bisect.js';
import { configCommand } from './commands/config.js';
import { watchCommand } from './commands/watch.js';
import { launchHomeDashboard } from './ui/dashboard/home.js';
import { pc } from './ui/prompts.js';

const program = new Command();

program
  .name(APP_NAME)
  .description('Platform CLI modern untuk manajemen mod & modpack Minecraft via Modrinth API')
  .version(APP_VERSION);

// Global Error Handler wrapper
function handleAction<T extends unknown[]>(fn: (...args: T) => Promise<void>) {
  return async (...args: T) => {
    try {
      await fn(...args);
    } catch (err) {
      console.error(pc.red(`\n❌ Kesalahan: ${(err as Error).message}`));
      process.exitCode = 1;
    }
  };
}

// 1. init
program
  .command('init')
  .description('Wizard interaktif untuk mendeteksi launcher & memilih instance target')
  .action(handleAction(initCommand));

// 2. search
program
  .command('search')
  .description('Mencari mod, modpack, shader, atau resource pack di Modrinth')
  .argument('<query>', 'Kata kunci pencarian')
  .option('-t, --type <type>', 'Tipe proyek: mod | modpack | shader | resourcepack', 'mod')
  .option('-v, --mc-version <version>', 'Versi Minecraft spesifik')
  .option('-l, --loader <loader>', 'Mod loader: fabric | forge | neoforge | quilt')
  .option('-n, --limit <n>', 'Jumlah hasil pencarian', '10')
  .option('-s, --sort <index>', 'Urutan: relevance | downloads | follows | newest | updated', 'relevance')
  .option('--json', 'Tampilkan hasil dalam format JSON murni')
  .action(
    handleAction(async (query: string, opts) => {
      await searchCommand(query, opts);
    })
  );

// 3. install
program
  .command('install')
  .description('Memasang mod, link Modrinth, atau modpack (.mrpack) ke folder instance')
  .argument('<targets...>', 'Nama mod, slug, URL Modrinth, atau file .mrpack lokal')
  .option('-t, --type <type>', 'Tipe aset: mod | modpack | shader | resourcepack')
  .option('-v, --mc-version <version>', 'Versi Minecraft target')
  .option('-l, --loader <loader>', 'Mod loader target')
  .option('-d, --dir <path>', 'Folder mods kustom')
  .option('-e, --env <target>', 'Target lingkungan: client | server', 'client')
  .option('--dry-run', 'Simulasi instalasi tanpa mengubah berkas di disk')
  .option('--no-deps', 'Lewati pemasangan dependensi otomatis')
  .option('-y, --yes', 'Otomatis setujui semua prompt')
  .action(
    handleAction(async (targets: string[], opts) => {
      await installCommand(targets, opts);
    })
  );

// 4. list
program
  .command('list')
  .description('Menampilkan daftar aset yang terpasang pada instance aktif')
  .option('-d, --dir <path>', 'Folder mods kustom')
  .option('--json', 'Keluarkan output dalam format JSON murni')
  .action(
    handleAction(async (opts) => {
      await listCommand(opts);
    })
  );

// 5. update
program
  .command('update')
  .description('Memeriksa & memperbarui mod terpasang ke versi terbaru yang kompatibel')
  .option('-v, --mc-version <version>', 'Versi Minecraft')
  .option('-l, --loader <loader>', 'Mod loader')
  .option('-d, --dir <path>', 'Folder mods kustom')
  .option('--prerelease', 'Sertakan versi beta/alpha')
  .option('-y, --yes', 'Otomatis lakukan pembaruan tanpa konfirmasi')
  .action(
    handleAction(async (opts) => {
      await updateCommand(opts);
    })
  );

// 6. remove
program
  .command('remove')
  .alias('rm')
  .description('Menghapus mod terpasang beserta pembersihan dependensi yatim (prune)')
  .argument('<targets...>', 'Nama mod atau slug yang ingin dihapus')
  .option('-d, --dir <path>', 'Folder mods kustom')
  .option('--prune', 'Otomatis bersihkan dependensi yatim yang tidak lagi terpakai')
  .option('-y, --yes', 'Otomatis setujui konfirmasi penghapusan')
  .action(
    handleAction(async (targets: string[], opts) => {
      await removeCommand(targets, opts);
    })
  );

// 7. enable & disable
program
  .command('enable')
  .description('Mengaktifkan mod yang dinonaktifkan (.jar.disabled -> .jar)')
  .argument('<mod>', 'Nama berkas mod atau slug')
  .option('-d, --dir <path>', 'Folder mods kustom')
  .action(
    handleAction(async (mod: string, opts) => {
      await toggleCommand(mod, true, opts);
    })
  );

program
  .command('disable')
  .description('Menonaktifkan mod tanpa menghapus berkas (.jar -> .jar.disabled)')
  .argument('<mod>', 'Nama berkas mod atau slug')
  .option('-d, --dir <path>', 'Folder mods kustom')
  .action(
    handleAction(async (mod: string, opts) => {
      await toggleCommand(mod, false, opts);
    })
  );

// 8. bisect
program
  .command('bisect')
  .description('Alat pencarian biner otomatis untuk mengisolasi mod penyebab crash')
  .argument('<action>', 'start | good | bad | reset')
  .option('-d, --dir <path>', 'Folder mods kustom')
  .action(
    handleAction(async (action: string, opts) => {
      await bisectCommand(action, opts);
    })
  );

// 9. config
const configCmd = program.command('config').description('Kelola konfigurasi global LoadModer');

configCmd
  .command('show')
  .description('Tampilkan konfigurasi aktif saat ini')
  .action(
    handleAction(async () => {
      await configCommand('show');
    })
  );

configCmd
  .command('use')
  .description('Alihkan instance aktif')
  .argument('<instanceId>', 'ID instance')
  .action(
    handleAction(async (instanceId: string) => {
      await configCommand('use', instanceId);
    })
  );

configCmd
  .command('set')
  .description('Ubah pengaturan konfigurasi')
  .argument('<key>', 'Key pengaturan: mc-version | loader | env')
  .argument('<value>', 'Nilai pengaturan')
  .action(
    handleAction(async (key: string, value: string) => {
      await configCommand('set', key, value);
    })
  );

// 10. watch
program
  .command('watch')
  .description('Memantau folder mods secara real-time dan menyinkronkan data saat berkas diubah atau dihapus manual')
  .option('-d, --dir <path>', 'Folder mods kustom yang ingin dipantau')
  .action(
    handleAction(async (opts) => {
      await watchCommand(opts);
    })
  );

// 11. home
program
  .command('home')
  .description('Buka antarmuka interaktif dashboard LoadModer')
  .action(handleAction(launchHomeDashboard));

// Jika dipanggil tanpa argumen tambahan (seperti anichi / an), otomatis buka Home Dashboard
if (process.argv.length <= 2) {
  await launchHomeDashboard();
} else {
  await program.parseAsync(process.argv);
}
