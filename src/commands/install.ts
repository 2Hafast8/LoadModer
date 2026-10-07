import path from "node:path";
import {createHash} from "node:crypto";
import {createReadStream} from "node:fs";
import {copyFile, mkdir, readdir, rm, stat} from "node:fs/promises";
import {modrinthClient} from "../api/client.js";
import {instanceConfig} from "../core/instance/config.js";
import {ModpackUnpacker} from "../core/modpack/unpacker.js";
import {ModpackProfileManager} from "../core/modpack/profileManager.js";
import {DependencyGraph} from "../core/dependency/graph.js";
import {resolveAndInstallDependencies} from "../core/dependency/resolver.js";
import {p, pc, showBanner, exitIfCancel} from "../ui/prompts.js";
import {formatBytes} from "../utils/format.js";
import type {ModVersion, ModProject} from "../types/modrinth.js";
import {getLauncherCapabilities} from "../core/instance/capabilities.js";
import {BaselineManager} from "../core/modpack/baselineManager.js";

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
  modsOnly?: boolean;
  full?: boolean;
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
      const caps = getLauncherCapabilities(activeInst?.launcher);
      if (!caps.supportsModpack) {
        p.log.error(
          caps.incompatibilityReason ??
            `Launcher "${activeInst?.launcher ?? "Official Minecraft"}" tidak mendukung format .mrpack secara langsung.`,
        );
        p.log.info(
          "Tips: Launcher resmi tidak memiliki isolasi modpack. Pasang mod individual (.jar) atau gunakan launcher pihak ketiga.",
        );
        process.exitCode = 1;
        continue;
      }

      p.log.step(pc.magenta(`Memproses modpack: ${target}`));
      const unpacker = new ModpackUnpacker(modrinthClient);

      let mrpackFile = target;
      let packLoader: string | undefined = opts.loader;
      let packGameVersion: string | undefined = gameVersion;
      let packFileObj: any = null;

      if (!target.endsWith(".mrpack")) {
        const s = p.spinner();
        s.start(`Mencari modpack "${target}" di Modrinth...`);
        let versions = await modrinthClient.getProjectVersions(target, {
          gameVersion,
          loader: opts.loader,
        });
        if (versions.length === 0 && (opts.loader || gameVersion)) {
          versions = await modrinthClient.getProjectVersions(target, {gameVersion});
        }
        if (versions.length === 0) {
          versions = await modrinthClient.getProjectVersions(target);
        }
        s.stop();

        if (versions.length === 0) {
          p.log.error(`Modpack "${target}" tidak ditemukan di Modrinth.`);
          continue;
        }

        const bestVer = versions[0];
        if (!bestVer) continue;

        packLoader =
          opts.loader ??
          bestVer.loaders?.find((l) =>
            ["fabric", "forge", "neoforge", "quilt"].includes(l.toLowerCase()),
          ) ??
          bestVer.loaders?.[0];
        packGameVersion = bestVer.game_versions?.[0] ?? gameVersion;

        const packFile =
          bestVer.files.find((f) => f.filename.endsWith(".mrpack")) ?? bestVer.files[0];
        if (!packFile) {
          p.log.error(`Tidak ada berkas .mrpack yang ditemukan untuk "${target}".`);
          continue;
        }
        packFileObj = packFile;
      } else {
        try {
          const modpackIndex = await unpacker.inspect(target);
          if (modpackIndex.dependencies) {
            for (const [dep, ver] of Object.entries(modpackIndex.dependencies)) {
              const lower = dep.toLowerCase();
              if (lower.includes("fabric")) packLoader = "fabric";
              else if (lower.includes("neoforge")) packLoader = "neoforge";
              else if (lower.includes("forge")) packLoader = "forge";
              else if (lower.includes("quilt")) packLoader = "quilt";
              if (lower === "minecraft" && typeof ver === "string") packGameVersion = ver;
            }
          }
        } catch {}
      }

      const container = await ModpackProfileManager.resolveContainerForLoader(
        instanceDir,
        packLoader ?? activeInst?.loader,
        packGameVersion ?? activeInst?.gameVersion,
        activeInst?.launcher,
      );

      if (container.containerDir !== instanceDir) {
        const launcherLabel = activeInst?.launcher === "Legacy" ? "Legacy Launcher" : "TLauncher";
        p.log.info(
          `Wadah ${launcherLabel} disesuaikan: ${pc.bold(container.containerName)} (${pc.cyan(container.matchedLoader)}) di ${pc.dim(container.containerDir)}`,
        );
      }

      // One-time golden baseline snapshot before any modpack modifications
      await BaselineManager.createBaselineOnce(container.containerDir);

      // ACTIVE MODPACK DOWNLOAD GUARD:
      const activeProfileCheck = await ModpackProfileManager.getActiveProfile(container.containerDir);
      if (activeProfileCheck && activeProfileCheck.activeProfile) {
        const activeName = activeProfileCheck.name ?? activeProfileCheck.activeProfile;
        if (!opts.yes && process.stdin.isTTY) {
          p.log.warn(
            pc.yellow(
              `⚠️  Wadah "${pc.bold(container.containerName)}" saat ini memiliki profil modpack aktif: "${pc.bold(activeName)}".`,
            ),
          );

          const conflictAction = await p.select({
            message: "Profil modpack masih aktif di wadah ini. Pilih tindakan Anda:",
            options: [
              {
                value: "cancel",
                label: "❌ Jangan download (Batalkan pemasangan)",
                hint: "Tetap gunakan modpack yang sedang aktif saat ini tanpa mengubah berkas apa pun.",
              },
              {
                value: "clean_and_install",
                label: "🧹 Download & bersihkan version client (Clean Install)",
                hint: "Arsipkan modpack aktif ke brankas profil, bersihkan wadah client, lalu unduh & pasang modpack baru.",
              },
            ],
          });
          exitIfCancel(conflictAction);

          if (conflictAction === "cancel") {
            p.log.info(pc.dim("Pemasangan modpack dibatalkan oleh pengguna. Profil aktif tetap dipertahankan."));
            continue;
          }

          const spinClean = p.spinner();
          spinClean.start(
            `Mengarsipkan modpack aktif "${activeName}" & membersihkan wadah...`,
          );
          await ModpackProfileManager.saveActiveToProfile(container.containerDir, {
            onProgress: (copied, total, file) => {
              spinClean.message(`Mengarsipkan profil [${copied}/${total}] ${path.basename(file)}...`);
            },
          });
          await ModpackProfileManager.clearContainerLiveFiles(container.containerDir);
          spinClean.stop(pc.green("Wadah client berhasil dibersihkan & profil sebelumnya diamankan ke brankas."));
        } else if (!opts.yes) {
          p.log.error(
            `Wadah "${container.containerName}" memiliki profil aktif "${activeName}". Gunakan flag --yes untuk mengarsipkan dan membersihkan secara otomatis.`,
          );
          continue;
        } else {
          await ModpackProfileManager.saveActiveToProfile(container.containerDir);
          await ModpackProfileManager.clearContainerLiveFiles(container.containerDir);
        }
      }

      const downloadsDir = ModpackProfileManager.getDownloadsDir(container.containerDir);
      await mkdir(downloadsDir, {recursive: true});

      const safePackFilename = path.basename(packFileObj ? packFileObj.filename : target);
      const targetDownloadedPath = path.join(downloadsDir, safePackFilename);

      if (packFileObj) {
        let needDownloadMaster = true;
        try {
          const s = await stat(targetDownloadedPath);
          if (s.isFile() && s.size > 0 && packFileObj.hashes?.sha512) {
            const hasher = createHash("sha512");
            const stream = createReadStream(targetDownloadedPath);
            for await (const chunk of stream) {
              hasher.update(chunk);
            }
            if (hasher.digest("hex").toLowerCase() === packFileObj.hashes.sha512.toLowerCase()) {
              needDownloadMaster = false;
              p.log.info(pc.dim("Berkas master modpack (.mrpack) sudah tersedia dan valid di disk."));
            }
          }
        } catch {}

        if (needDownloadMaster) {
          const spinMaster = p.spinner();
          spinMaster.start(`Mengunduh berkas modpack master (${safePackFilename})...`);
          await modrinthClient.download(packFileObj.url, targetDownloadedPath, {
            sha512: packFileObj.hashes?.sha512,
            size: packFileObj.size,
            onProgress: (received, total) => {
              const pct = total > 0 ? Math.round((received / total) * 100) : 0;
              spinMaster.message(
                `Mengunduh master modpack [${formatBytes(received)} / ${formatBytes(total)} (${pct}%)]...`,
              );
            },
          });
          spinMaster.stop(
            pc.green(`✔ Berkas master modpack berhasil diunduh (${safePackFilename}).`),
          );
        }
        mrpackFile = targetDownloadedPath;
      } else if (path.resolve(target) !== path.resolve(targetDownloadedPath)) {
        await copyFile(target, targetDownloadedPath);
        mrpackFile = targetDownloadedPath;
      }

      // LANGSUNG DAFTARKAN PROFIL SETELAH SELESAI DOWNLOAD .MRPACK
      const packInspection = await unpacker.inspect(mrpackFile);
      const profileId =
        path
          .basename(mrpackFile, path.extname(mrpackFile))
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, "-") || "modpack";

      await ModpackProfileManager.createProfileAfterInstall(container.containerDir, {
        id: profileId,
        name: packInspection.name,
        versionId: packInspection.versionId,
        loader: container.matchedLoader,
        gameVersion: packGameVersion ?? activeInst?.gameVersion,
      });
      p.log.success(
        pc.green(`✔ Profil modpack "${packInspection.name}" (${profileId}) berhasil didaftarkan ke brankas!`),
      );

      let modsOnly = false;
      if (opts.modsOnly) {
        modsOnly = true;
      } else if (opts.full) {
        modsOnly = false;
      } else if (!opts.yes && process.stdin.isTTY) {
        const choice = await p.select({
          message: "Pilih mode pemasangan modpack:",
          options: [
            {
              value: "mods_only",
              label: "Only Mods (Hanya Mod) — Rekomendasi",
              hint: "Hanya unduh berkas mod ke folder mods/. Pengaturan & config asli tidak ditimpa.",
            },
            {
              value: "full",
              label: "Full Modpack (Lengkap)",
              hint: "Pasang mod dan ekstrak seluruh konfigurasi/overrides ke wadah terisolasi.",
            },
          ],
        });
        exitIfCancel(choice);
        modsOnly = choice === "mods_only";
      }

      if (opts.dryRun) {
        p.log.info(
          `[DRY-RUN] Modpack "${target}" (Mode: ${modsOnly ? "Only Mods" : "Full"}) akan dipasang di ${container.containerName} (${container.containerDir}). Berkas master: ${targetDownloadedPath}`,
        );
        continue;
      }

      const activeProfile = await ModpackProfileManager.getActiveProfile(container.containerDir);
      if (activeProfile && activeProfile.activeProfile && activeProfile.activeProfile !== profileId) {
        const spinSave = p.spinner();
        spinSave.start(`Mengarsipkan modpack aktif "${activeProfile.name ?? activeProfile.activeProfile}"...`);
        await ModpackProfileManager.saveActiveToProfile(container.containerDir, {
          onProgress: (copied, total, file) => {
            spinSave.message(
              `Mengarsipkan profil [${copied}/${total}] ${path.basename(file)}...`,
            );
          },
        });
        await ModpackProfileManager.clearContainerLiveFiles(container.containerDir);
        spinSave.stop(pc.green("Profil sebelumnya berhasil diamankan ke penyimpanan."));
      }

      const s = p.spinner();
      s.start(
        modsOnly
          ? "Mengunduh dan memasang berkas mod (Only Mods)..."
          : `Mengekstrak dan mengunduh berkas modpack ke wadah ${container.containerName}...`,
      );
      const {index, installedFiles, failedFiles} = await unpacker.install(mrpackFile, {
        instanceDir: container.containerDir,
        targetEnv,
        modsOnly,
        onProgress: (done, total, file, isCached) => {
          if (done >= total) {
            s.message(
              pc.cyan(`✔ Seluruh berkas modpack selesai diproses (${total}/${total}). Menyelesaikan instalasi...`),
            );
          } else if (isCached) {
            s.message(`Memverifikasi [${done}/${total}] ${path.basename(file)} (Tersedia di disk)...`);
          } else {
            s.message(`Mengunduh [${done}/${total}] ${path.basename(file)}...`);
          }
        },
      });

      if (failedFiles && failedFiles.length > 0) {
        s.stop(pc.yellow(`Instalasi selesai dengan ${failedFiles.length} berkas yang dilewati.`));
        p.log.warn(
          pc.yellow(
            `⚠️  Peringatan: ${failedFiles.length} berkas mod tidak dapat diunduh (koneksi/server Modrinth):\n` +
              failedFiles.map((f) => `   - ${f}`).join("\n"),
          ),
        );
        s.start(pc.cyan("Mengamankan snapshot ke brankas profil..."));
      } else {
        s.message(pc.cyan("Mengamankan snapshot ke brankas profil..."));
      }

      const packGraph = new DependencyGraph(
        container.containerDir,
        packGameVersion ?? activeInst?.gameVersion ?? "",
        container.matchedLoader,
      );
      await packGraph.load();

      for (const file of index.files) {
        if (modsOnly && !file.path.startsWith("mods/") && !file.path.endsWith(".jar")) {
          continue;
        }
        if (!installedFiles.includes(file.path)) {
          continue;
        }
        const basename = path.basename(file.path);
        const fileExt = path.extname(basename).toLowerCase();
        const baseSlug = basename.replace(/\.(jar|zip|mrpack)$/i, "").toLowerCase();

        if (file.path.startsWith("shaderpacks/") || file.path.includes("/shaderpacks/")) {
          packGraph.registerAsset("shader", baseSlug, {
            filename: basename,
            sha512: file.hashes.sha512,
          });
        } else if (file.path.startsWith("resourcepacks/") || file.path.includes("/resourcepacks/")) {
          packGraph.registerAsset("resourcepack", baseSlug, {
            filename: basename,
            sha512: file.hashes.sha512,
          });
        } else if (fileExt === ".jar" || file.path.startsWith("mods/") || file.path.includes("/mods/")) {
          packGraph.registerMod(baseSlug, {
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

      await packGraph.save();
      await ModpackProfileManager.saveActiveToProfile(container.containerDir, {
        onProgress: (copied, total, file) => {
          s.message(`Mengamankan snapshot profil [${copied}/${total}] ${path.basename(file)}...`);
        },
      });

      const activeKey = instanceConfig.get().activeInstance;
      if (activeKey && instanceConfig.get().instances[activeKey]) {
        const inst = instanceConfig.get().instances[activeKey];
        inst.mode = "modpack";
        inst.activeContainer = container.containerName;
        inst.modsDir = path.join(container.containerDir, "mods");
        if (packGameVersion ?? activeInst?.gameVersion) {
          inst.gameVersion = packGameVersion ?? activeInst?.gameVersion;
        }
        if (container.matchedLoader) {
          inst.loader = container.matchedLoader as any;
        }
      }
      await instanceConfig.save();

      s.stop(
        pc.green(
          `Modpack "${index.name}" (${index.versionId}) berhasil dipasang & diaktifkan di wadah "${container.containerName}"!`,
        ),
      );
      p.log.message(
        pc.cyan(`💡 Di TLauncher: Pilih versi "${container.containerName}" di dropdown versi untuk bermain.`),
      );
      p.log.message(
        pc.dim("💡 Berkas master tersimpan di: ") + pc.white(targetDownloadedPath),
      );
      p.log.message(
        pc.dim("💡 Kelola profil modpack kapan saja via ") +
          pc.cyan("lm home") +
          pc.dim(" atau perintah ") +
          pc.cyan("lm modpack switch / lm modpack disable"),
      );
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
