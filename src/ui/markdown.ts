import chalk from "chalk";
import {theme} from "./theme.js";

const ANSI_OSC_REGEX = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
const DANGEROUS_CONTROL_CHARS = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;

export function renderMarkdownToTerminal(md: string): string {
  if (!md || !md.trim()) return chalk.hex(theme.muted)("(Tidak ada konten yang tersedia)");

  let text = md
    .replace(ANSI_OSC_REGEX, "")
    .replace(DANGEROUS_CONTROL_CHARS, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(center|div|p|span|b|strong|i|em)[^>]*>/gi, "")
    .replace(/<img[^>]*alt=["']([^"']*)["'][^>]*>/gi, "[$1]")
    .replace(/<img[^>]*>/gi, "")
    .replace(/<a\s+[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, "$2 ($1)")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"');

  const lines = text.split(/\r?\n/);
  const formattedLines: string[] = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      if (inCodeBlock) {
        formattedLines.push(
          chalk.hex(theme.muted)("  ┌── [Code Block] ──────────────────────────"),
        );
      } else {
        formattedLines.push(
          chalk.hex(theme.muted)("  └── [End Code] ────────────────────────────"),
        );
      }
      continue;
    }

    if (inCodeBlock) {
      formattedLines.push(`  ${chalk.hex(theme.info)(line)}`);
      continue;
    }

    if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) {
      formattedLines.push(chalk.hex(theme.border)("─".repeat(60)));
      continue;
    }

    if (line.startsWith("# ")) {
      formattedLines.push("");
      formattedLines.push(chalk.hex(theme.primary).bold(`■ ${line.slice(2).trim().toUpperCase()}`));
      formattedLines.push(chalk.hex(theme.border)("─".repeat(40)));
      continue;
    }
    if (line.startsWith("## ")) {
      formattedLines.push("");
      formattedLines.push(chalk.hex(theme.secondary).bold(`▶ ${line.slice(3).trim()}`));
      continue;
    }
    if (line.startsWith("### ")) {
      formattedLines.push("");
      formattedLines.push(chalk.hex(theme.info).bold(`• ${line.slice(4).trim()}`));
      continue;
    }
    if (line.startsWith("#### ")) {
      formattedLines.push(chalk.hex(theme.warning).bold(`  - ${line.slice(5).trim()}`));
      continue;
    }

    if (line.trim().startsWith(">")) {
      const quoteContent = line.replace(/^\s*>\s*/, "");
      formattedLines.push(
        `  ${chalk.hex(theme.muted)("│")} ${chalk.hex(theme.textMuted).italic(quoteContent)}`,
      );
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const cleanItem = line.replace(/^\s*[-*+]\s+/, "");
      const styled = formatInlineMarkdown(cleanItem);
      formattedLines.push(`  ${chalk.hex(theme.primary)("•")} ${styled}`);
      continue;
    }

    const numMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/);
    if (numMatch) {
      const num = numMatch[2];
      const rest = formatInlineMarkdown(numMatch[3]);
      formattedLines.push(`  ${chalk.hex(theme.secondary)(`${num}.`)} ${rest}`);
      continue;
    }

    formattedLines.push(formatInlineMarkdown(line));
  }

  return formattedLines.join("\n");
}

function formatInlineMarkdown(text: string): string {
  let res = text;

  res = res.replace(/`([^`]+)`/g, (_m, code) =>
    chalk.bgHex("#1e293b").hex(theme.info)(` ${code} `),
  );
  res = res.replace(/\*\*([^*]+)\*\*/g, (_m, content) => chalk.bold.hex(theme.text)(content));
  res = res.replace(/__([^_]+)__/g, (_m, content) => chalk.bold.hex(theme.text)(content));
  res = res.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, (_m, content) => chalk.italic(content));
  res = res.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, title, url) => {
    return `${chalk.hex(theme.primary).underline(title)} ${chalk.hex(theme.muted)(`(${url})`)}`;
  });

  return res;
}
