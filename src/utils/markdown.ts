import chalk from 'chalk';
import boxen from 'boxen';
import { theme } from '../ui/theme.js';
import { askInteractiveMenu, ask, type InteractiveChoice } from '../ui/interactive.js';
import { showBanner, clearScreen } from '../ui/theme.js';

/**
 * Mengonversi teks Markdown mentah dari Modrinth (body / changelog)
 * menjadi format teks TUI terminal yang bersih, rapi, dan mudah dibaca.
 */
export function renderMarkdownToTerminal(md: string): string {
  if (!md || !md.trim()) return chalk.hex(theme.muted)('(Tidak ada konten yang tersedia)');

  // 1. Bersihkan tag HTML umum (Modrinth sering menyertakan <center>, <img>, <a>)
  let text = md
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(center|div|p|span|b|strong|i|em)[^>]*>/gi, '')
    .replace(/<img[^>]*alt=["']([^"']*)["'][^>]*>/gi, '[$1]')
    .replace(/<img[^>]*>/gi, '')
    .replace(/<a\s+[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"');

  const lines = text.split(/\r?\n/);
  const formattedLines: string[] = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Deteksi blok kode (```)
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      if (inCodeBlock) {
        formattedLines.push(chalk.hex(theme.muted)('  ┌── [Code Block] ──────────────────────────'));
      } else {
        formattedLines.push(chalk.hex(theme.muted)('  └── [End Code] ────────────────────────────'));
      }
      continue;
    }

    if (inCodeBlock) {
      formattedLines.push(`  ${chalk.hex(theme.info)(line)}`);
      continue;
    }

    // Horizontal Rule (--- atau ***)
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) {
      formattedLines.push(chalk.hex(theme.border)('─'.repeat(60)));
      continue;
    }

    // Headings: #, ##, ###
    if (line.startsWith('# ')) {
      formattedLines.push('');
      formattedLines.push(chalk.hex(theme.primary).bold(`■ ${line.slice(2).trim().toUpperCase()}`));
      formattedLines.push(chalk.hex(theme.border)('─'.repeat(40)));
      continue;
    }
    if (line.startsWith('## ')) {
      formattedLines.push('');
      formattedLines.push(chalk.hex(theme.secondary).bold(`▶ ${line.slice(3).trim()}`));
      continue;
    }
    if (line.startsWith('### ')) {
      formattedLines.push('');
      formattedLines.push(chalk.hex(theme.info).bold(`• ${line.slice(4).trim()}`));
      continue;
    }
    if (line.startsWith('#### ')) {
      formattedLines.push(chalk.hex(theme.warning).bold(`  - ${line.slice(5).trim()}`));
      continue;
    }

    // Blockquote (> text)
    if (line.trim().startsWith('>')) {
      const quoteContent = line.replace(/^\s*>\s*/, '');
      formattedLines.push(`  ${chalk.hex(theme.muted)('│')} ${chalk.hex(theme.textMuted).italic(quoteContent)}`);
      continue;
    }

    // Bullet List (- item atau * item)
    if (/^\s*[-*+]\s+/.test(line)) {
      const cleanItem = line.replace(/^\s*[-*+]\s+/, '');
      const styled = formatInlineMarkdown(cleanItem);
      formattedLines.push(`  ${chalk.hex(theme.primary)('•')} ${styled}`);
      continue;
    }

    // Numbered List (1. item)
    const numMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/);
    if (numMatch) {
      const num = numMatch[2];
      const rest = formatInlineMarkdown(numMatch[3]);
      formattedLines.push(`  ${chalk.hex(theme.secondary)(`${num}.`)} ${rest}`);
      continue;
    }

    // Teks biasa
    formattedLines.push(formatInlineMarkdown(line));
  }

  return formattedLines.join('\n');
}

/**
 * Format inline markdown: bold, italic, code, links
 */
function formatInlineMarkdown(text: string): string {
  let res = text;

  // Inline Code: `code`
  res = res.replace(/`([^`]+)`/g, (_m, code) => chalk.bgHex('#1e293b').hex(theme.info)(` ${code} `));

  // Bold: **text** atau __text__
  res = res.replace(/\*\*([^*]+)\*\*/g, (_m, content) => chalk.bold.hex(theme.text)(content));
  res = res.replace(/__([^_]+)__/g, (_m, content) => chalk.bold.hex(theme.text)(content));

  // Italic: *text* atau _text_
  res = res.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, (_m, content) => chalk.italic(content));

  // Markdown Link: [Title](URL)
  res = res.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, title, url) => {
    return `${chalk.hex(theme.primary).underline(title)} ${chalk.hex(theme.muted)(`(${url})`)}`;
  });

  return res;
}

/**
 * Menampilkan teks Markdown panjang dengan pagination interaktif
 * agar terminal tidak tergulung habis (overflow) dan pengguna nyaman membaca dokumentasi.
 */
export async function displayPaginatedMarkdown(
  title: string,
  rawMarkdown: string,
  pageSize = 22
): Promise<void> {
  const renderedText = renderMarkdownToTerminal(rawMarkdown);
  const lines = renderedText.split('\n');

  if (lines.length <= pageSize) {
    clearScreen();
    showBanner(undefined, true);
    console.log(
      boxen(renderedText, {
        padding: 1,
        margin: { top: 0, bottom: 1, left: 0, right: 0 },
        borderStyle: 'round',
        borderColor: theme.primary,
        title: chalk.bold.hex(theme.primary)(` 📖 ${title} `),
        titleAlignment: 'left',
      })
    );
    await ask('Tekan Enter untuk kembali ke detail mod...');
    return;
  }

  let offset = 0;
  let viewing = true;

  while (viewing) {
    const totalPages = Math.ceil(lines.length / pageSize);
    const currentPage = Math.floor(offset / pageSize) + 1;
    const currentChunk = lines.slice(offset, offset + pageSize).join('\n');

    const choices: InteractiveChoice[] = [];
    if (offset + pageSize < lines.length) {
      choices.push({
        name: `⬇  Halaman Berikutnya (Hal ${currentPage + 1}/${totalPages})`,
        value: 'next',
        hint: `${lines.length - (offset + pageSize)} baris tersisa`,
      });
    }
    if (offset > 0) {
      choices.push({
        name: `⬆  Halaman Sebelumnya (Hal ${currentPage - 1}/${totalPages})`,
        value: 'prev',
      });
    }
    choices.push({ name: '📜  Tampilkan Seluruhnya Sekaligus', value: 'all' });
    choices.push({ name: '──────────────────', value: 'sep' });
    choices.push({ name: '[Kembali ke Detail Mod]', value: 'back' });

    const selected = await askInteractiveMenu(
      `NAVIGASI DOKUMENTASI [${currentPage}/${totalPages}]`,
      choices,
      () => {
        showBanner(undefined, true);
        console.log(
          boxen(currentChunk, {
            padding: 1,
            margin: { top: 0, bottom: 1, left: 0, right: 0 },
            borderStyle: 'round',
            borderColor: theme.primary,
            title: chalk.bold.hex(theme.primary)(` 📖 ${title} (Halaman ${currentPage}/${totalPages}) `),
            titleAlignment: 'left',
          })
        );
      }
    );

    if (!selected || selected === 'back' || selected === 'sep') {
      viewing = false;
      break;
    }

    if (selected === 'next') {
      offset += pageSize;
    } else if (selected === 'prev') {
      offset = Math.max(0, offset - pageSize);
    } else if (selected === 'all') {
      clearScreen();
      showBanner(undefined, true);
      console.log(renderedText);
      console.log('');
      await ask('Tekan Enter untuk kembali ke detail mod...');
      viewing = false;
      break;
    }
  }
}
