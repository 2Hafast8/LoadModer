import React from 'react';

interface MarkdownViewerProps {
  content: string;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content }) => {
  if (!content || !content.trim()) {
    return (
      <div className="text-nordic-muted text-xs italic py-4">
        Tidak ada deskripsi detail yang disediakan oleh pembuat proyek.
      </div>
    );
  }

  // Pre-process markdown to clean raw HTML comments or dangerous script tags
  const sanitized = content
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  const lines = sanitized.split(/\r?\n/);
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let inList = false;
  let listItems: string[] = [];

  const flushList = (key: string) => {
    if (inList && listItems.length > 0) {
      elements.push(
        <ul key={key} className="list-disc list-inside space-y-1 my-2 text-xs text-nordic-text leading-relaxed pl-2">
          {listItems.map((item, idx) => (
            <li key={idx} dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const formatInline = (text: string): string => {
    // Escape basic html
    let out = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Inline code `code`
    out = out.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-obsidian-card border border-obsidian-border text-[11px] font-mono text-emerald-active">$1</code>');

    // Bold **text**
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-nordic-text">$1</strong>');

    // Italic *text*
    out = out.replace(/\*([^*]+)\*/g, '<em class="italic text-nordic-muted">$1</em>');

    // Strikethrough ~~text~~
    out = out.replace(/~~([^~]+)~~/g, '<del class="line-through text-nordic-muted">$1</del>');

    // Links [text](url)
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-emerald-primary hover:underline font-medium">$1</a>');

    return out;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Code blocks ```
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <div key={`code-${i}`} className="my-3 rounded border border-obsidian-border bg-obsidian-bg p-3 overflow-x-auto text-xs font-mono text-nordic-text">
            <pre>{codeBuffer.join('\n')}</pre>
          </div>
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        flushList(`list-before-code-${i}`);
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(rawLine);
      continue;
    }

    // Horizontal Rule
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
      flushList(`list-before-hr-${i}`);
      elements.push(<hr key={`hr-${i}`} className="my-4 border-obsidian-border" />);
      continue;
    }

    // Headings
    if (trimmed.startsWith('# ')) {
      flushList(`list-before-h1-${i}`);
      elements.push(
        <h1 key={`h1-${i}`} className="text-lg font-bold text-nordic-text mt-5 mb-2 pb-1 border-b border-obsidian-border">
          {trimmed.slice(2)}
        </h1>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushList(`list-before-h2-${i}`);
      elements.push(
        <h2 key={`h2-${i}`} className="text-base font-bold text-emerald-primary mt-4 mb-2">
          {trimmed.slice(3)}
        </h2>
      );
      continue;
    }
    if (trimmed.startsWith('### ')) {
      flushList(`list-before-h3-${i}`);
      elements.push(
        <h3 key={`h3-${i}`} className="text-sm font-semibold text-nordic-text mt-3 mb-1">
          {trimmed.slice(4)}
        </h3>
      );
      continue;
    }

    // Lists (- or *)
    if (/^[-*]\s+/.test(trimmed)) {
      inList = true;
      listItems.push(trimmed.replace(/^[-*]\s+/, ''));
      continue;
    } else {
      flushList(`list-${i}`);
    }

    // Images ![alt](url)
    const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      elements.push(
        <div key={`img-${i}`} className="my-3 rounded overflow-hidden border border-obsidian-border max-w-full">
          <img src={imgMatch[2]} alt={imgMatch[1] || 'Preview'} className="max-h-96 object-contain mx-auto" />
        </div>
      );
      continue;
    }

    // Paragraph
    if (trimmed.length > 0) {
      elements.push(
        <p
          key={`p-${i}`}
          className="text-xs text-nordic-text my-2 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }}
        />
      );
    }
  }

  flushList('list-end');

  return <div className="space-y-1">{elements}</div>;
};
