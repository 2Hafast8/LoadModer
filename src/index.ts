#!/usr/bin/env node
import {Command} from "commander";
import {APP_NAME, APP_VERSION} from "./constants.js";

const program = new Command();

program
  .name(APP_NAME)
  .description("Platform CLI modern untuk manajemen mod & modpack Minecraft via Modrinth API")
  .version(APP_VERSION);

function handleAction<T extends unknown[]>(fn: (...args: T) => Promise<void>) {
  return async (...args: T) => {
    try {
      await fn(...args);
    } catch (err) {
      console.error(`\x1b[31m\n❌ Kesalahan: ${(err as Error).message}\x1b[0m`);
      process.exitCode = 1;
    }
  };
}

program
  .command("init")
  .description("Wizard interaktif untuk mendeteksi launcher & memilih instance target")
  .option("-s, --scan", "Pindai seluruh drive lokal untuk folder .minecraft / minecraft")
  .option("-p, --path <path>", "Tentukan path folder .minecraft / minecraft secara manual")
  .action(
    handleAction(async (opts) => {
      const {initCommand} = await import("./commands/init.js");
      await initCommand(opts);
    }),
  );

program
  .command("search")
  .description("Mencari mod, modpack, shader, atau resource pack di Modrinth")
  .argument("<query>", "Kata kunci pencarian")
  .option("-t, --type <type>", "Tipe proyek: mod | modpack | shader | resourcepack", "mod")
  .option("-v, --mc-version <version>", "Versi Minecraft spesifik")
  .option("-l, --loader <loader>", "Mod loader: fabric | forge | neoforge | quilt")
  .option(
    "-c, --category <category>",
    "Filter kategori Modrinth (misal: optimization, adventure, library)",
  )
  .option("-e, --env <target>", "Target lingkungan: client | server")
  .option("-n, --limit <n>", "Jumlah hasil pencarian", "10")
  .option(
    "-s, --sort <index>",
    "Urutan: relevance | downloads | follows | newest | updated",
    "relevance",
  )
  .option("--json", "Tampilkan hasil dalam format JSON murni")
  .action(
    handleAction(async (query: string, opts) => {
      const {searchCommand} = await import("./commands/search.js");
      await searchCommand(query, opts);
    }),
  );

program
  .command("install")
  .description("Memasang mod, link Modrinth, atau modpack (.mrpack) ke folder instance")
  .argument("<targets...>", "Nama mod, slug, URL Modrinth, atau file .mrpack lokal")
  .option("-t, --type <type>", "Tipe aset: mod | modpack | shader | resourcepack")
  .option("-v, --mc-version <version>", "Versi Minecraft target")
  .option("-l, --loader <loader>", "Mod loader target")
  .option("-d, --dir <path>", "Folder mods kustom")
  .option("-e, --env <target>", "Target lingkungan: client | server", "client")
  .option("--dry-run", "Simulasi instalasi tanpa mengubah berkas di disk")
  .option("--no-deps", "Lewati pemasangan dependensi otomatis")
  .option("-y, --yes", "Otomatis setujui semua prompt")
  .action(
    handleAction(async (targets: string[], opts) => {
      const {installCommand} = await import("./commands/install.js");
      await installCommand(targets, opts);
    }),
  );

program
  .command("list")
  .description("Menampilkan daftar aset yang terpasang pada instance aktif")
  .option("-t, --type <type>", "Tipe aset: all | mod | shader | resourcepack", "all")
  .option("-d, --dir <path>", "Folder mods kustom")
  .option("--json", "Keluarkan output dalam format JSON murni")
  .action(
    handleAction(async (opts) => {
      const {listCommand} = await import("./commands/list.js");
      await listCommand(opts);
    }),
  );

program
  .command("update")
  .description("Memeriksa & memperbarui mod terpasang ke versi terbaru yang kompatibel")
  .option("-v, --mc-version <version>", "Versi Minecraft")
  .option("-l, --loader <loader>", "Mod loader")
  .option("-d, --dir <path>", "Folder mods kustom")
  .option("--prerelease", "Sertakan versi beta/alpha")
  .option("-y, --yes", "Otomatis lakukan pembaruan tanpa konfirmasi")
  .action(
    handleAction(async (opts) => {
      const {updateCommand} = await import("./commands/update.js");
      await updateCommand(opts);
    }),
  );

program
  .command("remove")
  .alias("rm")
  .description("Menghapus mod terpasang beserta pembersihan dependensi yatim (prune)")
  .argument("<targets...>", "Nama mod atau slug yang ingin dihapus")
  .option("-t, --type <type>", "Tipe aset: mod | shader | resourcepack", "mod")
  .option("-d, --dir <path>", "Folder mods kustom")
  .option("--prune", "Otomatis bersihkan dependensi yatim yang tidak lagi terpakai")
  .option("-y, --yes", "Otomatis setujui konfirmasi penghapusan")
  .action(
    handleAction(async (targets: string[], opts) => {
      const {removeCommand} = await import("./commands/remove.js");
      await removeCommand(targets, opts);
    }),
  );

program
  .command("enable")
  .description("Mengaktifkan mod yang dinonaktifkan (.jar.disabled -> .jar)")
  .argument("<mod>", "Nama berkas mod atau slug")
  .option("-d, --dir <path>", "Folder mods kustom")
  .action(
    handleAction(async (mod: string, opts) => {
      const {toggleCommand} = await import("./commands/toggle.js");
      await toggleCommand(mod, true, opts);
    }),
  );

program
  .command("disable")
  .description("Menonaktifkan mod tanpa menghapus berkas (.jar -> .jar.disabled)")
  .argument("<mod>", "Nama berkas mod atau slug")
  .option("-d, --dir <path>", "Folder mods kustom")
  .action(
    handleAction(async (mod: string, opts) => {
      const {toggleCommand} = await import("./commands/toggle.js");
      await toggleCommand(mod, false, opts);
    }),
  );

program
  .command("bisect")
  .description("Alat pencarian biner otomatis untuk mengisolasi mod penyebab crash")
  .argument("<action>", "start | good | bad | reset")
  .option("-d, --dir <path>", "Folder mods kustom")
  .action(
    handleAction(async (action: string, opts) => {
      const {bisectCommand} = await import("./commands/bisect.js");
      await bisectCommand(action, opts);
    }),
  );

const configCmd = program.command("config").description("Kelola konfigurasi global LoadModer");

configCmd
  .command("show")
  .description("Tampilkan konfigurasi aktif saat ini")
  .action(
    handleAction(async () => {
      const {configCommand} = await import("./commands/config.js");
      await configCommand("show");
    }),
  );

configCmd
  .command("use")
  .description("Alihkan instance aktif")
  .argument("<instanceId>", "ID instance")
  .action(
    handleAction(async (instanceId: string) => {
      const {configCommand} = await import("./commands/config.js");
      await configCommand("use", instanceId);
    }),
  );

configCmd
  .command("set")
  .description("Ubah pengaturan konfigurasi")
  .argument("<key>", "Key pengaturan: mc-version | loader | env")
  .argument("<value>", "Nilai pengaturan")
  .action(
    handleAction(async (key: string, value: string) => {
      const {configCommand} = await import("./commands/config.js");
      await configCommand("set", key, value);
    }),
  );

program
  .command("watch")
  .description(
    "Memantau folder mods secara real-time dan menyinkronkan data saat berkas diubah atau dihapus manual",
  )
  .option("-d, --dir <path>", "Folder mods kustom yang ingin dipantau")
  .action(
    handleAction(async (opts) => {
      const {watchCommand} = await import("./commands/watch.js");
      await watchCommand(opts);
    }),
  );

const profileCmd = program
  .command("profile")
  .description("Kelola profil versi Minecraft dan mod loader (auto-snapshot & restore)");

profileCmd
  .command("list")
  .description("Menampilkan daftar snapshot profil tersimpan")
  .action(
    handleAction(async () => {
      const {profileListCommand} = await import("./commands/profile.js");
      await profileListCommand();
    }),
  );

profileCmd
  .command("switch")
  .description("Beralih ke versi Minecraft atau mod loader lain")
  .option("-l, --loader <loader>", "Mod loader target (fabric | forge | neoforge | quilt)")
  .option("-v, --mc-version <version>", "Versi Minecraft target (misal: 1.21.1)")
  .action(
    handleAction(async (opts) => {
      const {profileSwitchCommand} = await import("./commands/profile.js");
      await profileSwitchCommand(opts.loader, opts.mcVersion);
    }),
  );

program
  .command("home")
  .description("Buka antarmuka interaktif dashboard LoadModer")
  .action(
    handleAction(async () => {
      const {launchHomeDashboard} = await import("./ui/dashboard/home.js");
      await launchHomeDashboard();
    }),
  );

if (process.argv.length <= 2) {
  const {launchHomeDashboard} = await import("./ui/dashboard/home.js");
  await launchHomeDashboard();
} else {
  await program.parseAsync(process.argv);
}
