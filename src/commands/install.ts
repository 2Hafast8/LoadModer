import path from "node:path";
import {readdir, rm} from "node:fs/promises";
import {modrinthClient} from "../api/client.js";
import {instanceConfig} from "../core/instance/config.js";
import {ModpackUnpacker} from "../core/modpack/unpacker.js";
import {DependencyGraph} from "../core/dependency/graph.js";
import {resolveAndInstallDependencies} from "../core/dependency/resolver.js";
import {p, pc, showBanner} from "../ui/prompts.js";
import {formatBytes} from "../utils/format.js";
import type {ModVersion, ModProject} from "../types/modrinth.js";

interface InstallOptions {
  type?: string;
  mcVersion?: string;
  loader?: string;
  versionId?: string;
  dir?: string;
  env?: "client" | "server";
  dryRun?: boolean;
  yes?: boolean;
  noDeps?: boolean;
  skipBanner?: boolean;
}

export async function installCommand(targets: string[], opts: InstallOptions) {
  if (!opts.skipBanner) {
    showBanner();
  }
  await instanceConfig.load();
  const activeInst = instanceConfig.getActiveInstance();

  const modsDir = opts.dir ?? activeInst?.modsDir;
  if (!modsDir) {
    p.log.error('Folder mods belum ditentukan. Jalankan "loadmoder init" terlebih dahulu.');
    process.exitCode = 1;
    return;
  }

  const gameVersion = opts.mcVersion ?? activeInst?.gameVersion;
  const loader = opts.loader ?? activeInst?.loader;
  const targetEnv = opts.env ?? "client";

  const targetHasMods = targets.some(
    (t) => !t.endsWith(".mrpack") && opts.type !== "shader" && opts.type !== "resourcepack" && opts.type !== "modpack"
  );
  if (targetHasMods && (!gameVersion || !loader)) {
    p.log.error(
      'Versi Minecraft atau loader belum ditentukan pada instance aktif. Gunakan flag -v dan -l atau jalankan "lm init".',
    );
    process.exitCode = 1;
    return;
  }

  p.log.info(
    `Instance: ${pc.bold(activeInst?.name ?? "Kustom")} | MC: ${pc.cyan(gameVersion ?? "Auto")} | Loader: ${pc.cyan(loader ?? "Auto")} | Env: ${pc.cyan(targetEnv)}`,
  );

  const instanceDir = activeInst?.rootDir ?? path.dirname(modsDir);
  const graph = new DependencyGraph(instanceDir, gameVersion ?? "", loader ?? "");
  await graph.load();

  for (const target of targets) {
    if (target.endsWith(".mrpack") || opts.type === "modpack") {
      p.log.step(pc.magenta(`Memproses modpack: ${target}`));
      const unpacker = new ModpackUnpacker(modrinthClient);

      let mrpackFile = target;
      if (!target.endsWith(".mrpack")) {
        const s = p.spinner();
        s.start(`Mencari modpack "${target}" di Modrinth...`);
        const versions = await modrinthClient.getProjectVersions(target, {gameVersion, loader});
        s.stop();
        if (versions.length === 0) {
          p.log.error(`Modpack "${target}" tidak ditemukan untuk MC ${gameVersion}/${loader}.`);
          continue;
        }
        const bestVer = versions[0];
        if (!bestVer) continue;
        const packFile =
          bestVer.files.find((f) => f.filename.endsWith(".mrpack")) ?? bestVer.files[0];
        if (!packFile) {
          p.log.error(`Tidak ada berkas .mrpack yang ditemukan untuk "${target}".`);
          continue;
        }
        const safePackFilename = path.basename(packFile.filename);
        mrpackFile = path.resolve(instanceDir, safePackFilename);
        const rootInstance = path.resolve(instanceDir);
        if (!mrpackFile.startsWith(rootInstance + path.sep) && mrpackFile !== rootInstance) {
          throw new Error(`Nama berkas modpack tidak aman (path traversal): ${packFile.filename}`);
        }

        p.log.info(`Mengunduh berkas modpack ${safePackFilename}...`);
        await modrinthClient.download(packFile.url, mrpackFile, {sha512: packFile.hashes.sha512});
      }

      const s = p.spinner();
      s.start("Mengekstrak dan mengunduh seluruh berkas modpack...");
      const index = await unpacker.install(mrpackFile, {
        instanceDir,
        targetEnv,
        onProgress: (done, total, file) => {
          s.message(`Mengunduh [${done}/${total}] ${path.basename(file)}...`);
        },
      });

      if (!target.endsWith(".mrpack")) {
        try {
          await rm(mrpackFile, {force: true});
        } catch {}
      }

      for (const file of index.files) {
        const basename = path.basename(file.path);
        const fileExt = path.extname(basename).toLowerCase();
        const baseSlug = basename.replace(/\.(jar|zip|mrpack)$/i, "").toLowerCase();

        if (file.path.startsWith("shaderpacks/") || file.path.includes("/shaderpacks/")) {
          graph.registerAsset("shader", baseSlug, {
            filename: basename,
            sha512: file.hashes.sha512,
          });
        } else if (file.path.startsWith("resourcepacks/") || file.path.includes("/resourcepacks/")) {
          graph.registerAsset("resourcepack", baseSlug, {
            filename: basename,
            sha512: file.hashes.sha512,
          });
        } else if (fileExt === ".jar" || file.path.startsWith("mods/") || file.path.includes("/mods/")) {
          graph.registerMod(baseSlug, {
            projectId: baseSlug,
            versionId: index.versionId,
            versionNumber: index.versionId,
            filename: basename,
            sha512: file.hashes.sha512,
            isRoot: true,
            dependencies: [],
          });
        }
      }

      await graph.save();
      s.stop(pc.green(`Modpack "${index.name}" (${index.versionId}) berhasil dipasang!`));
      continue;
    }

    let slug = target;
    if (slug.includes("modrinth.com/mod/")) {
      slug = slug.split("modrinth.com/mod/")[1].split("/")[0];
    }

    p.log.step(`Mencari mod: ${pc.bold(slug)}...`);
    let best: ModVersion | undefined;
    if (opts.versionId) {
      try {
        best = await modrinthClient.getVersion(opts.versionId);
      } catch (err: any) {
        p.log.error(
          `Gagal mengambil versi dengan ID "${opts.versionId}": ${err?.message ?? "Versi tidak ditemukan"}`,
        );
        continue;
      }
    }

    if (!best) {
      const versions = await modrinthClient.getProjectVersions(slug, {gameVersion, loader});
      if (versions.length === 0) {
        p.log.error(
          `Tidak ada versi yang cocok untuk "${slug}" di Minecraft ${gameVersion ?? ""} / ${loader ?? ""}`,
        );
        continue;
      }
      best = versions.find((v) => v.version_type === "release") ?? versions[0];
    }

    if (!best) {
      p.log.error(`Tidak dapat menemukan versi yang valid untuk mod "${slug}".`);
      continue;
    }

    const file = best.files.find((f) => f.primary) ?? best.files[0];
    if (!file) {
      p.log.error(`Tidak ada file unduhan untuk mod "${slug}".`);
      continue;
    }

    let projectMeta: ModProject | undefined;
    try {
      projectMeta = await modrinthClient.getProject(best.project_id || slug);
    } catch {}

    const projectType = opts.type || projectMeta?.project_type || "mod";
    let destDir = modsDir;
    if (projectType === "shader") {
      destDir = path.join(instanceDir, "shaderpacks");
    } else if (projectType === "resourcepack") {
      destDir = path.join(instanceDir, "resourcepacks");
    }

    if (opts.dryRun) {
      p.log.info(
        `[dry-run] Akan memasang ${projectType}: ${file.filename} (${formatBytes(file.size)}) ke ${destDir}`,
      );
      if (projectType === "mod" && !opts.noDeps) {
        await resolveAndInstallDependencies({
          mainModSlug: slug,
          mainVersion: best,
          project: projectMeta,
          modsDir,
          gameVersion: gameVersion!,
          loader: loader!,
          graph,
          dryRun: true,
          onLog: (level, msg) => {
            if (level === "step") p.log.step(msg);
            else if (level === "warn") p.log.warn(pc.yellow(msg));
            else if (level === "dim") p.log.message(pc.dim(msg));
            else if (level === "success") p.log.message(pc.green(msg));
            else p.log.info(msg);
          },
        });
      }
      continue;
    }

    p.log.info(
      `⬇️  Mengunduh ${projectType} ${pc.cyan(file.filename)} (${formatBytes(file.size)})...`,
    );
    if (!file.hashes?.sha512) {
      p.log.error(`Berkas ${file.filename} tidak memiliki hash integritas SHA-512 dari Modrinth.`);
      continue;
    }

    const safeFilename = path.basename(file.filename);
    const dest = path.resolve(destDir, safeFilename);
    const rootDest = path.resolve(destDir);
    if (!dest.startsWith(rootDest + path.sep) && dest !== rootDest) {
      throw new Error(`Nama berkas tidak aman (path traversal): ${file.filename}`);
    }

    await modrinthClient.download(file.url, dest, {
      sha512: file.hashes.sha512,
      size: file.size,
    });

    try {
      const existingFiles = await readdir(destDir);
      const oldModEntry = graph.getMod(slug);
      const escapedSlug = slug.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const versionRegex = new RegExp(`^${escapedSlug}[-_][0-9v]`, "i");

      for (const ex of existingFiles) {
        if (
          ex !== safeFilename &&
          ((oldModEntry && ex === oldModEntry.filename) || versionRegex.test(ex)) &&
          (ex.endsWith(".jar") || ex.endsWith(".zip"))
        ) {
          try {
            await rm(path.join(destDir, ex), {force: true});
            p.log.message(pc.dim(`Versi lama dihapus: ${ex}`));
          } catch (rmErr: any) {
            p.log.warn(
              `Gagal menghapus versi lama (${ex}): ${rmErr?.message ?? "Berkas sedang digunakan oleh aplikasi lain"}`,
            );
          }
        }
      }
    } catch {}

    if (projectType === "shader") {
      graph.registerAsset("shader", slug, {
        filename: file.filename,
        sha512: file.hashes.sha512,
      });
    } else if (projectType === "resourcepack") {
      graph.registerAsset("resourcepack", slug, {
        filename: file.filename,
        sha512: file.hashes.sha512,
      });
    } else {
      const reqDeps = (best.dependencies || [])
        .filter(
          (d): d is typeof d & {project_id: string} =>
            d.dependency_type === "required" && Boolean(d.project_id),
        )
        .map((d) => d.project_id);

      graph.registerMod(slug, {
        projectId: best.project_id,
        versionId: best.id,
        versionNumber: best.version_number,
        filename: file.filename,
        sha512: file.hashes.sha512,
        isRoot: true,
        dependencies: reqDeps,
      });

      if (!opts.noDeps) {
        const depResult = await resolveAndInstallDependencies({
          mainModSlug: slug,
          mainVersion: best,
          project: projectMeta,
          modsDir,
          gameVersion: gameVersion!,
          loader: loader!,
          graph,
          dryRun: opts.dryRun,
          onLog: (level, msg) => {
            if (level === "step") p.log.step(msg);
            else if (level === "warn") p.log.warn(pc.yellow(msg));
            else if (level === "dim") p.log.message(pc.dim(msg));
            else if (level === "success") p.log.message(pc.green(msg));
            else p.log.info(msg);
          },
        });

        if (depResult.installed.length > 0) {
          p.log.success(
            pc.green(
              `✔ Berhasil memasang ${depResult.installed.length} library tambahan yang sesuai untuk ${loader!.toUpperCase()} ${gameVersion!}!`,
            ),
          );
        }
      }
    }

    await graph.save();
    p.log.success(pc.green(`Berhasil dipasang: ${file.filename}`));
  }

  p.outro(pc.green("Semua aset selesai diproses! Selamat bermain 🎮"));
}
