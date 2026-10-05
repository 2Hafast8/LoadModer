import chalk from "chalk";
import boxen from "boxen";
import {theme, showBanner, clearScreen} from "./theme.js";
import {askInteractiveMenu, ask, type InteractiveChoice} from "./interactive.js";
import {renderMarkdownToTerminal} from "./markdown.js";

export async function displayPaginatedMarkdown(
  title: string,
  rawMarkdown: string,
  pageSize = 22,
): Promise<void> {
  const renderedText = renderMarkdownToTerminal(rawMarkdown);
  const lines = renderedText.split("\n");

  if (lines.length <= pageSize) {
    clearScreen();
    showBanner(undefined, true);
    console.log(
      boxen(renderedText, {
        padding: { top: 0, bottom: 0, left: 1, right: 1 },
        margin: { top: 0, bottom: 1, left: 0, right: 0 },
        borderStyle: "round",
        borderColor: theme.border,
        title: chalk.hex(theme.primary).bold(` 📖 ${title} `),
        titleAlignment: "left",
      }),
    );
    await ask("Tekan Enter untuk kembali ke detail mod...");
    return;
  }

  let offset = 0;
  let viewing = true;

  while (viewing) {
    const totalPages = Math.ceil(lines.length / pageSize);
    const currentPage = Math.floor(offset / pageSize) + 1;
    const currentChunk = lines.slice(offset, offset + pageSize).join("\n");

    const choices: InteractiveChoice[] = [];
    if (offset + pageSize < lines.length) {
      choices.push({
        name: `⬇  Halaman Berikutnya (Hal ${currentPage + 1}/${totalPages})`,
        value: "next",
        hint: `${lines.length - (offset + pageSize)} baris tersisa`,
      });
    }
    if (offset > 0) {
      choices.push({
        name: `⬆  Halaman Sebelumnya (Hal ${currentPage - 1}/${totalPages})`,
        value: "prev",
      });
    }
    choices.push({name: "📜  Tampilkan Seluruhnya Sekaligus", value: "all"});
    choices.push({name: "──────────────────", value: "sep"});
    choices.push({name: "[Kembali ke Detail Mod]", value: "back"});

    const selected = await askInteractiveMenu(
      `NAVIGASI DOKUMENTASI [${currentPage}/${totalPages}]`,
      choices,
      () => {
        showBanner(undefined, true);
        console.log(
          boxen(currentChunk, {
            padding: { top: 0, bottom: 0, left: 1, right: 1 },
            margin: { top: 0, bottom: 0, left: 0, right: 0 },
            borderStyle: "round",
            borderColor: theme.border,
            title: chalk.hex(theme.primary).bold(
              ` 📖 ${title} (Halaman ${currentPage}/${totalPages}) `,
            ),
            titleAlignment: "left",
          }),
        );
      },
    );

    if (!selected || selected === "back" || selected === "sep") {
      viewing = false;
      break;
    }

    if (selected === "next") {
      offset += pageSize;
    } else if (selected === "prev") {
      offset = Math.max(0, offset - pageSize);
    } else if (selected === "all") {
      clearScreen();
      showBanner(undefined, true);
      console.log(renderedText);
      console.log("");
      await ask("Tekan Enter untuk kembali ke detail mod...");
      viewing = false;
      break;
    }
  }
}
