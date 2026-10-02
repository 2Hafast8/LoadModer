import chalk from "chalk";
import Table from "cli-table3";
import {modrinthClient, type SearchIndex} from "../../api/client.js";
import {showBanner, clearScreen, logger, theme, tableChars} from "../theme.js";
import {
  askInteractiveMenu,
  ask,
  getMinecraftVersionChoices,
  type InteractiveChoice,
} from "../interactive.js";
import {formatNumber} from "../../utils/format.js";
import {runRemoteModDetailRoute} from "./detail.js";
import {instanceConfig} from "../../core/instance/config.js";
import {p, pc} from "../prompts.js";
import type {SavedInstanceConfig} from "../../types/instance.js";
import type {ProjectType} from "../../types/modrinth.js";

export const CONTENT_TYPE_LABELS: Record<ProjectType, string> = {
  mod: "Mod Minecraft (.jar)",
  modpack: "Modpack (.mrpack)",
  shader: "Shader Pack (Visual & Cahaya)",
  resourcepack: "Resource Pack (Tekstur & GUI)",
  datapack: "Data Pack",
};

export const CATEGORIES_BY_TYPE: Record<ProjectType, Array<{slug: string; name: string}>> = {
  mod: [
    {slug: "optimization", name: "Optimasi & FPS Boost"},
    {slug: "adventure", name: "Petualangan & Eksplorasi"},
    {slug: "magic", name: "Sihir & Supranatural"},
    {slug: "technology", name: "Teknologi & Otomasi"},
    {slug: "decoration", name: "Dekorasi & Blok"},
    {slug: "storage", name: "Penyimpanan & Chest"},
    {slug: "utility", name: "Utilitas & Tool"},
    {slug: "library", name: "Library & API"},
    {slug: "worldgen", name: "Generasi Dunia & Bioma"},
    {slug: "mobs", name: "Mob & Makhluk"},
    {slug: "food", name: "Makanan & Pertanian"},
    {slug: "equipment", name: "Senjata, Armor & Alat"},
  ],
  modpack: [
    {slug: "optimization", name: "Optimasi & Ringan"},
    {slug: "adventure", name: "Petualangan & Eksplorasi"},
    {slug: "quests", name: "Quest & Progresi"},
    {slug: "tech", name: "Teknologi & Industri"},
    {slug: "magic", name: "Sihir & Misteri"},
    {slug: "combat", name: "PvP & Pertarungan"},
    {slug: "kitchen-sink", name: "All-in-One (Kitchen Sink)"},
    {slug: "challenging", name: "Tantangan Hardcore"},
  ],
  shader: [
    {slug: "low", name: "Low-End (Ringan & Cepat)"},
    {slug: "medium", name: "Medium (Seimbang)"},
    {slug: "high", name: "High / Ultra (Detail Tinggi)"},
    {slug: "path-tracing", name: "Ray Tracing / Path Tracing"},
    {slug: "photorealistic", name: "Fotorealistis"},
    {slug: "cartoon", name: "Kartun & Cel Shading"},
    {slug: "vanilla-like", name: "Mendekati Vanilla Plus"},
  ],
  resourcepack: [
    {slug: "combat", name: "PvP & Combat (Ringkas)"},
    {slug: "faith-vanilla", name: "Faithful / Vanilla Plus"},
    {slug: "medieval", name: "Abad Pertengahan & Rustik"},
    {slug: "modern", name: "Modern & Minimalis"},
    {slug: "photo-realistic", name: "Fotorealistis"},
    {slug: "futuristic", name: "Futuristik & Sci-Fi"},
    {slug: "utility", name: "Utilitas, Font & GUI"},
  ],
  datapack: [
    {slug: "adventure", name: "Petualangan"},
    {slug: "magic", name: "Sihir"},
    {slug: "utility", name: "Utilitas"},
  ],
};

function getSortLabel(sort: SearchIndex): string {
  switch (sort) {
    case "downloads":
      return "Unduhan Terbanyak";
    case "relevance":
      return "Paling Relevan";
    case "follows":
      return "Pengikut Terbanyak";
    case "newest":
      return "Rilis Terbaru";
    case "updated":
      return "Baru Diperbarui";
  }
}

export async function runInteractiveBrowser(
  activeInstance: SavedInstanceConfig | undefined,
  initialQuery = "",
  initialProjectType: ProjectType = "mod",
): Promise<void> {
  let query = initialQuery;
  let offset = 0;
  const limit = 10;
  let browsing = true;

  let currentProjectType: ProjectType = initialProjectType;
  let filterVersion: string | undefined = activeInstance?.gameVersion;
  let filterLoader: string | undefined =
    initialProjectType === "shader" || initialProjectType === "resourcepack"
      ? undefined
      : activeInstance?.loader;
  let filterCategory: string | undefined = undefined;
  let filterEnvironment: "client" | "server" | undefined = undefined;
  let sortIndex: SearchIndex = "downloads";

  while (browsing) {
    await instanceConfig.load();
    const currentInstance = instanceConfig.getActiveInstance() ?? activeInstance;

    clearScreen();
    logger.muted(
      `  Mengambil ${CONTENT_TYPE_LABELS[currentProjectType] || currentProjectType} dari Modrinth API...`,
    );

    let res;
    try {
      res = await modrinthClient.search(
        query,
        {
          gameVersion: filterVersion,
          loader: filterLoader,
          projectType: currentProjectType,
          category: filterCategory,
          environment: filterEnvironment,
        },
        limit,
        sortIndex,
        offset,
      );
    } catch (err: any) {
      clearScreen();
      showBanner(currentInstance?.name, true);
      p.log.error(`Gagal mencari di Modrinth: ${err.message}`);
      await ask("Tekan Enter untuk mencoba kembali...");
      continue;
    }

    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.max(1, Math.ceil(res.total_hits / limit));

    const renderHeader = () => {
      showBanner(currentInstance?.name, true);

      const filterTable = new Table({
        head: [
          chalk.hex(theme.secondary).bold("Parameter Filter"),
          chalk.hex(theme.secondary).bold("Pengaturan Aktif"),
        ],
        colWidths: [22, 54],
        wordWrap: true,
        chars: tableChars,
        style: {head: [], border: [theme.border]},
      });

      const typeVal = chalk
        .hex(theme.primary)
        .bold(CONTENT_TYPE_LABELS[currentProjectType] || currentProjectType.toUpperCase());
      const verVal = filterVersion
        ? chalk.hex(theme.success).bold(filterVersion)
        : chalk.dim("Semua Versi (Tanpa Batasan)");
      const loaderVal = filterLoader
        ? chalk.hex(theme.warning).bold(filterLoader.toUpperCase())
        : chalk.dim("Semua Loader (Agnostik)");
      const catObj = CATEGORIES_BY_TYPE[currentProjectType]?.find((c) => c.slug === filterCategory);
      const catVal = filterCategory
        ? chalk.hex(theme.info)(catObj ? `${catObj.name} (${filterCategory})` : filterCategory)
        : chalk.dim("Semua Kategori");
      const envVal = filterEnvironment
        ? chalk.hex(theme.secondary)(
            filterEnvironment === "client"
              ? "Client-Only (Sisi Klien)"
              : "Server-Only (Sisi Server)",
          )
        : chalk.dim("Semua (Client & Server)");
      const sortVal = chalk.hex(theme.textMuted)(getSortLabel(sortIndex));

      filterTable.push(
        [chalk.hex(theme.textMuted)("Tipe Konten"), typeVal],
        [chalk.hex(theme.textMuted)("Versi Minecraft"), verVal],
        [chalk.hex(theme.textMuted)("Mod Loader"), loaderVal],
        [chalk.hex(theme.textMuted)("Kategori"), catVal],
        [chalk.hex(theme.textMuted)("Lingkungan"), envVal],
        [chalk.hex(theme.textMuted)("Urutan (Sort)"), sortVal],
      );

      console.log(filterTable.toString());
    };

    if (res.hits.length === 0) {
      clearScreen();
      renderHeader();
      logger.warn(
        `Tidak ditemukan ${currentProjectType} untuk kata kunci "${query || "(tanpa query)"}".`,
      );
      p.log.message(
        pc.dim("Tips: Coba sesuaikan filter kategori/versi atau gunakan kata kunci lain."),
      );

      const emptyChoices: InteractiveChoice[] = [
        {name: "⚙️   Atur / Longgarkan Filter (Versi, Loader, Kategori)", value: "filter_settings"},
        {name: "🔍  Ketik Kata Kunci Baru", value: "new_search"},
        {name: "🔄  Reset Semua Filter ke Default", value: "reset_filters"},
        {name: "──────────────────", value: "sep"},
        {name: "[Kembali ke Dashboard Utama]", value: "back"},
      ];

      const emptyAction = await askInteractiveMenu(
        "OPSI PENCARIAN NIHIL",
        emptyChoices,
        renderHeader,
      );

      if (emptyAction === "back") {
        browsing = false;
        break;
      } else if (emptyAction === "filter_settings") {
        const changed = await handleFilterSettings();
        if (changed) offset = 0;
        continue;
      } else if (emptyAction === "reset_filters") {
        filterVersion = currentInstance?.gameVersion;
        filterLoader =
          currentProjectType === "shader" || currentProjectType === "resourcepack"
            ? undefined
            : currentInstance?.loader;
        filterCategory = undefined;
        filterEnvironment = undefined;
        query = "";
        offset = 0;
        continue;
      } else if (emptyAction === "new_search") {
        const newQuery = await ask("Ketik kata kunci pencarian baru:");
        query = newQuery?.trim() ?? "";
        offset = 0;
        continue;
      }
    }

    const choices: InteractiveChoice[] = res.hits.map((hit) => {
      let typeBadge = "";
      if (hit.project_type === "modpack") typeBadge = chalk.magenta("[PACK] ");
      else if (hit.project_type === "shader") typeBadge = chalk.cyan("[SHDR] ");
      else if (hit.project_type === "resourcepack") typeBadge = chalk.yellow("[RP] ");

      return {
        name: `${typeBadge}${hit.title} [${hit.slug}]`,
        value: hit.slug,
        hint: `⬇ ${formatNumber(hit.downloads)}  •  ${hit.categories?.slice(0, 3).join(", ") ?? "-"}  •  ${hit.author}`,
      };
    });

    choices.push({name: "──────────────────", value: "sep"});
    if (offset + limit < res.total_hits) {
      choices.push({
        name: `[Halaman Berikutnya (Hal ${currentPage + 1}/${totalPages})]`,
        value: "next_page",
      });
    }
    if (offset > 0) {
      choices.push({
        name: `[Halaman Sebelumnya (Hal ${currentPage - 1}/${totalPages})]`,
        value: "prev_page",
      });
    }
    choices.push({
      name: "⚙️   Atur / Kustomisasi Filter (Versi, Loader, Kategori, Env)",
      value: "filter_settings",
    });
    choices.push({
      name: `↕️   Ubah Urutan Pencarian (Saat ini: ${getSortLabel(sortIndex)})`,
      value: "sort_settings",
    });
    choices.push({name: "🔍  Cari dengan Kata Kunci Baru", value: "new_search"});
    choices.push({name: "[Kembali ke Dashboard Utama]", value: "back"});

    const picked = await askInteractiveMenu(
      `EKSPLORASI ${currentProjectType.toUpperCase()} (Halaman ${currentPage}/${totalPages}  •  ${res.total_hits} Hasil)`,
      choices,
      renderHeader,
    );

    if (picked === "back") {
      browsing = false;
      break;
    } else if (picked === "next_page") {
      offset += limit;
    } else if (picked === "prev_page") {
      offset = Math.max(0, offset - limit);
    } else if (picked === "new_search") {
      const newQuery = await ask(
        "Ketik kata kunci pencarian baru (kosongkan untuk tampilkan semua):",
      );
      query = newQuery?.trim() ?? "";
      offset = 0;
    } else if (picked === "filter_settings") {
      const changed = await handleFilterSettings();
      if (changed) offset = 0;
    } else if (picked === "sort_settings") {
      const changed = await handleSortSettings();
      if (changed) offset = 0;
    } else if (picked !== "sep") {
      await runRemoteModDetailRoute(picked, currentInstance, currentProjectType);
    }
  }

  async function handleFilterSettings(): Promise<boolean> {
    let configuring = true;
    let anyChange = false;

    while (configuring) {
      clearScreen();
      showBanner(activeInstance?.name, true);

      const filterChoices: InteractiveChoice[] = [
        {
          name: `📦  1. Tipe Konten: ${chalk.hex(theme.primary).bold(CONTENT_TYPE_LABELS[currentProjectType] || currentProjectType)}`,
          value: "set_type",
          hint: "Ganti ke Mod, Modpack, Shader, atau Resource Pack",
        },
        {
          name: `🎮  2. Versi Minecraft: ${chalk.hex(theme.success).bold(filterVersion || "Semua Versi")}`,
          value: "set_version",
          hint: "Pilih versi game spesifik atau semua versi",
        },
        {
          name: `⚙️   3. Mod Loader: ${chalk.hex(theme.warning).bold(filterLoader?.toUpperCase() || "Semua Loader")}`,
          value: "set_loader",
          hint: "Fabric, Forge, NeoForge, Quilt, atau Semua",
        },
        {
          name: `🏷️   4. Kategori: ${chalk.hex(theme.info).bold(filterCategory || "Semua Kategori")}`,
          value: "set_category",
          hint: `Pilih genre/kategori khusus untuk ${currentProjectType}`,
        },
        {
          name: `🖥️   5. Lingkungan: ${chalk.hex(theme.secondary).bold(filterEnvironment?.toUpperCase() || "Semua (Client & Server)")}`,
          value: "set_env",
          hint: "Khusus sisi klien, sisi server, atau keduanya",
        },
        {
          name: "🔄  6. Reset Seluruh Filter ke Default Instance",
          value: "reset_all",
          hint: `Kembali ke ${activeInstance?.loader || "-"} ${activeInstance?.gameVersion || "-"}`,
        },
        {name: "──────────────────", value: "sep"},
        {name: "[✔ Selesai & Terapkan Filter]", value: "done"},
      ];

      const action = await askInteractiveMenu(
        "PENGATURAN CUSTOM FILTER MODRINTH",
        filterChoices,
        () => showBanner(activeInstance?.name, true),
      );

      if (!action || action === "done" || action === "sep") {
        configuring = false;
        break;
      }

      switch (action) {
        case "set_type": {
          const typeChoices: InteractiveChoice[] = [
            {name: "📦  Mod Minecraft (.jar)", value: "mod"},
            {name: "🗃️   Modpack (.mrpack)", value: "modpack"},
            {name: "✨  Shader Pack (Visual & Cahaya)", value: "shader"},
            {name: "🎨  Resource Pack (Tekstur & GUI)", value: "resourcepack"},
            {name: "💾  Data Pack", value: "datapack"},
          ];
          const chosenType = await askInteractiveMenu(
            "Pilih Tipe Konten yang Dicari:",
            typeChoices,
          );
          if (chosenType && chosenType !== currentProjectType) {
            currentProjectType = chosenType as ProjectType;
            filterCategory = undefined;
            if (currentProjectType === "shader" || currentProjectType === "resourcepack") {
              filterLoader = undefined;
            } else if (!filterLoader && activeInstance?.loader) {
              filterLoader = activeInstance.loader;
            }
            anyChange = true;
          }
          break;
        }

        case "set_version": {
          const vChoices = await getMinecraftVersionChoices(filterVersion);
          vChoices.unshift({
            name: `${!filterVersion ? "● " : "○ "}Semua Versi (Tanpa Filter)`,
            value: "__all__",
          });
          vChoices.push({name: "──────────────────", value: "sep"});
          vChoices.push({name: "✏️   Ketik Versi Minecraft Manual...", value: "__custom__"});

          const chosenV = await askInteractiveMenu("Pilih Filter Versi Minecraft:", vChoices);
          if (chosenV === "__all__") {
            filterVersion = undefined;
            anyChange = true;
          } else if (chosenV === "__custom__") {
            const manual = await ask("Masukkan versi Minecraft (misal: 1.20.1 atau 26.2):");
            if (manual && manual.trim()) {
              filterVersion = manual.trim();
              anyChange = true;
            }
          } else if (chosenV && chosenV !== "sep") {
            filterVersion = chosenV;
            anyChange = true;
          }
          break;
        }

        case "set_loader": {
          const lChoices: InteractiveChoice[] = [
            {name: `${!filterLoader ? "● " : "○ "}Semua Loader (Agnostik)`, value: "__all__"},
            {name: `${filterLoader === "fabric" ? "● " : "○ "}Fabric`, value: "fabric"},
            {name: `${filterLoader === "neoforge" ? "● " : "○ "}NeoForge`, value: "neoforge"},
            {name: `${filterLoader === "forge" ? "● " : "○ "}Forge`, value: "forge"},
            {name: `${filterLoader === "quilt" ? "● " : "○ "}Quilt`, value: "quilt"},
          ];
          const chosenL = await askInteractiveMenu("Pilih Filter Mod Loader:", lChoices);
          if (chosenL === "__all__") {
            filterLoader = undefined;
            anyChange = true;
          } else if (chosenL) {
            filterLoader = chosenL;
            anyChange = true;
          }
          break;
        }

        case "set_category": {
          const availableCats = CATEGORIES_BY_TYPE[currentProjectType] || [];
          const catChoices: InteractiveChoice[] = [
            {name: `${!filterCategory ? "● " : "○ "}Semua Kategori`, value: "__all__"},
          ];
          for (const cat of availableCats) {
            const isSelected = filterCategory === cat.slug;
            catChoices.push({
              name: `${isSelected ? "● " : "○ "}${cat.name}`,
              value: cat.slug,
            });
          }
          const chosenC = await askInteractiveMenu(
            `Pilih Kategori untuk ${currentProjectType.toUpperCase()}:`,
            catChoices,
          );
          if (chosenC === "__all__") {
            filterCategory = undefined;
            anyChange = true;
          } else if (chosenC) {
            filterCategory = chosenC;
            anyChange = true;
          }
          break;
        }

        case "set_env": {
          const envChoices: InteractiveChoice[] = [
            {name: `${!filterEnvironment ? "● " : "○ "}Semua (Client & Server)`, value: "__all__"},
            {
              name: `${filterEnvironment === "client" ? "● " : "○ "}Client Saja (Klien Game)`,
              value: "client",
            },
            {
              name: `${filterEnvironment === "server" ? "● " : "○ "}Server Saja (Dedicated Server)`,
              value: "server",
            },
          ];
          const chosenE = await askInteractiveMenu("Pilih Filter Lingkungan:", envChoices);
          if (chosenE === "__all__") {
            filterEnvironment = undefined;
            anyChange = true;
          } else if (chosenE) {
            filterEnvironment = chosenE as "client" | "server";
            anyChange = true;
          }
          break;
        }

        case "reset_all": {
          filterVersion = activeInstance?.gameVersion;
          filterLoader =
            currentProjectType === "shader" || currentProjectType === "resourcepack"
              ? undefined
              : activeInstance?.loader;
          filterCategory = undefined;
          filterEnvironment = undefined;
          anyChange = true;
          p.log.success("Filter berhasil direset ke default instance!");
          await ask("Tekan Enter untuk melanjutkan...");
          break;
        }
      }
    }

    return anyChange;
  }

  async function handleSortSettings(): Promise<boolean> {
    const sortChoices: InteractiveChoice[] = [
      {
        name: `${sortIndex === "downloads" ? "● " : "○ "}Unduhan Terbanyak (Paling Populer)`,
        value: "downloads",
      },
      {
        name: `${sortIndex === "relevance" ? "● " : "○ "}Paling Relevan (Kesesuaian Kata Kunci)`,
        value: "relevance",
      },
      {name: `${sortIndex === "follows" ? "● " : "○ "}Pengikut Terbanyak`, value: "follows"},
      {name: `${sortIndex === "updated" ? "● " : "○ "}Paling Baru Diperbarui`, value: "updated"},
      {name: `${sortIndex === "newest" ? "● " : "○ "}Rilis Paling Baru`, value: "newest"},
    ];

    const chosenSort = await askInteractiveMenu("Pilih Urutan Hasil Pencarian:", sortChoices);
    if (chosenSort && chosenSort !== sortIndex) {
      sortIndex = chosenSort as SearchIndex;
      return true;
    }
    return false;
  }
}
