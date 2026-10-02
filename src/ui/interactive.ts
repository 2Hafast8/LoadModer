import chalk from "chalk";
import {select, input, search, Separator} from "@inquirer/prompts";
import {ExitPromptError} from "@inquirer/core";
import {clearScreen, theme} from "./theme.js";

export const ui = new Proxy(
  {
    separator: "─",
  } as Record<string, string>,
  {
    get(target, prop: string) {
      if (prop === "accent") return theme.primary;
      if (prop === "accentAlt") return theme.secondary;
      if (prop in target) return target[prop];
      return (theme as any)[prop];
    },
  },
);

export interface InteractiveChoice {
  name: string;
  value: string;
  hint?: string;
  disabled?: boolean | string;
}

export interface InteractiveMenuOptions {
  loop?: boolean;
  pageSize?: number;
  customFooter?: string;
  allowBackOnCancel?: boolean;
}

export function renderFooter(customHint?: string): string {
  if (customHint) {
    return chalk.hex(ui.muted)("  ") + customHint;
  }
  return (
    chalk.hex(ui.muted)("  ") +
    chalk.hex(ui.accent)("↑↓ / jk") +
    chalk.hex(ui.textMuted)(" Geser") +
    chalk.hex(ui.muted)("  •  ") +
    chalk.hex(ui.accent)("Enter") +
    chalk.hex(ui.textMuted)(" Pilih") +
    chalk.hex(ui.muted)("  •  ") +
    chalk.hex(ui.accentAlt)("Ctrl+C") +
    chalk.hex(ui.textMuted)(" Batal/Kembali")
  );
}

export async function askInteractiveMenu(
  message: string,
  choices: InteractiveChoice[],
  renderContext?: () => void,
  options?: InteractiveMenuOptions | string,
): Promise<string> {
  const opts = typeof options === "string" ? {customFooter: options} : options;
  const loop = opts?.loop ?? false;
  const pageSize = opts?.pageSize ?? 14;
  const allowBackOnCancel = opts?.allowBackOnCancel ?? true;

  if (renderContext) {
    clearScreen();
    renderContext();
    console.log("");
  }

  const inquirerChoices = choices.map((c) => {
    if (c.value === "sep") {
      const isPlainLine =
        !c.name ||
        c.name === "sep" ||
        c.name === "──────────────────" ||
        /^─+$/.test(c.name.trim());

      if (isPlainLine) {
        return new Separator(chalk.hex(ui.muted)("  " + ui.separator.repeat(54)));
      }

      const label = c.name.replace(/[─\-]/g, "").trim().toUpperCase();
      return new Separator(
        chalk.hex(ui.accentAlt).bold(`\n  ▸ ${label}`) +
          chalk.hex(ui.muted)(` ${ui.separator.repeat(Math.max(8, 46 - label.length))}`),
      );
    }

    if (c.name === "──────────────────" || /^─+$/.test(c.name.trim())) {
      return new Separator(chalk.hex(ui.muted)("  " + ui.separator.repeat(54)));
    }

    const isAction =
      c.name.startsWith("[") &&
      (c.name.includes("Kembali") ||
        c.name.includes("Keluar") ||
        c.name.includes("Halaman") ||
        c.name.includes("Cari"));

    const styledName = isAction ? chalk.hex(ui.accentAlt)(c.name) : chalk.hex(ui.text)(c.name);

    return {
      name: styledName,
      value: c.value,
      description: c.hint ? chalk.hex(ui.textMuted)(c.hint) : undefined,
      disabled: c.disabled,
    };
  });

  try {
    return await select({
      message: chalk.hex(ui.text).bold(message),
      choices: inquirerChoices,
      pageSize,
      loop,
      theme: {
        prefix: {
          idle: chalk.hex(ui.accent).bold("❖"),
          done: chalk.hex(ui.success).bold("✔"),
        },
        icon: {
          cursor: chalk.hex(ui.accent).bold("❯ "),
        },
        style: {
          message: (text: string) => chalk.hex(ui.text).bold(text),
          highlight: (text: string) => chalk.bgHex(ui.activeBg).hex(ui.accent).bold(` ${text} `),
          description: (text: string) => chalk.hex(ui.textMuted)(`› ${text}`),
          help: (text: string) => chalk.hex(ui.muted)(text),
        },
      },
    });
  } catch (err: any) {
    if (err?.name === "ExitPromptError" || err instanceof ExitPromptError) {
      if (allowBackOnCancel) {
        return "back";
      }
      console.log(chalk.hex(ui.muted)("\nOperasi dibatalkan.\n"));
      process.exit(130);
    }
    throw err;
  }
}

export async function askSearchMenu(
  message: string,
  choices: InteractiveChoice[],
  renderContext?: () => void,
  options?: {allowBackOnCancel?: boolean},
): Promise<string> {
  const allowBackOnCancel = options?.allowBackOnCancel ?? true;

  if (renderContext) {
    clearScreen();
    renderContext();
    console.log("");
  }

  try {
    return await search({
      message: chalk.hex(ui.text).bold(message),
      source: async (input) => {
        if (!input) {
          return choices
            .filter((c) => c.value !== "sep")
            .map((c) => ({
              name: chalk.hex(ui.text)(c.name),
              value: c.value,
              description: c.hint ? chalk.hex(ui.textMuted)(c.hint) : undefined,
            }));
        }

        const query = input.toLowerCase();
        return choices
          .filter(
            (c) =>
              c.value !== "sep" &&
              (c.name.toLowerCase().includes(query) ||
                (c.hint && c.hint.toLowerCase().includes(query))),
          )
          .map((c) => ({
            name: chalk.hex(ui.text)(c.name),
            value: c.value,
            description: c.hint ? chalk.hex(ui.textMuted)(c.hint) : undefined,
          }));
      },
      pageSize: 14,
      theme: {
        prefix: {
          idle: chalk.hex(ui.accent).bold("❖"),
          done: chalk.hex(ui.success).bold("✔"),
        },
        icon: {
          cursor: chalk.hex(ui.accent).bold("❯ "),
        },
        style: {
          message: (text: string) => chalk.hex(ui.text).bold(text),
          highlight: (text: string) => chalk.bgHex(ui.activeBg).hex(ui.accent).bold(` ${text} `),
          description: (text: string) => chalk.hex(ui.textMuted)(`› ${text}`),
          searchTerm: (text: string) => chalk.hex(ui.accent).bold(text),
        },
      },
    });
  } catch (err: any) {
    if (err?.name === "ExitPromptError" || err instanceof ExitPromptError) {
      if (allowBackOnCancel) {
        return "back";
      }
      console.log(chalk.hex(ui.muted)("\nOperasi dibatalkan.\n"));
      process.exit(130);
    }
    throw err;
  }
}

export async function ask(
  query: string,
  defaultValue?: string,
  options?: {allowBackOnCancel?: boolean},
): Promise<string> {
  const allowBackOnCancel = options?.allowBackOnCancel ?? true;

  try {
    return await input({
      message: chalk.hex(ui.text)(query),
      default: defaultValue,
      theme: {
        prefix: {
          idle: chalk.hex(ui.accent).bold("›"),
          done: chalk.hex(ui.success).bold("✔"),
        },
        style: {
          message: (text: string) => chalk.hex(ui.text)(text),
          answer: (text: string) => chalk.hex(ui.primary).bold(text),
          defaultAnswer: (text: string) => chalk.hex(ui.muted)(`(${text})`),
        },
      },
    });
  } catch (err: any) {
    if (err?.name === "ExitPromptError" || err instanceof ExitPromptError) {
      if (allowBackOnCancel) {
        return defaultValue ?? "";
      }
      console.log(chalk.hex(ui.muted)("\nOperasi dibatalkan.\n"));
      process.exit(130);
    }
    throw err;
  }
}

export async function getMinecraftVersionChoices(
  currentVersion?: string,
): Promise<InteractiveChoice[]> {
  const {getMinecraftReleaseVersions} = await import("../core/minecraft/versions.js");
  const versions = await getMinecraftReleaseVersions();
  const cleanCurrent = currentVersion?.toLowerCase().trim();

  const choices: InteractiveChoice[] = [];

  for (let i = 0; i < versions.length; i++) {
    const ver = versions[i];
    const isCurrent = cleanCurrent === ver.toLowerCase();

    let tagHint = "";
    if (isCurrent) {
      tagHint = "● Aktif Saat Ini";
    } else if (i === 0) {
      tagHint = "Versi Terkini";
    } else if (ver === "1.21.1") {
      tagHint = "Paling Populer & Stabil";
    } else if (ver === "1.20.1") {
      tagHint = "Koleksi Mod Terbesar";
    } else if (ver === "1.16.5") {
      tagHint = "Klasik Modern";
    }

    choices.push({
      name: `${isCurrent ? "● " : "○ "}Minecraft ${ver}`,
      value: ver,
      hint: tagHint || undefined,
    });
  }

  return choices;
}
