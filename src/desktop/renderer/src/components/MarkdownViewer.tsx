import React, { useMemo } from 'react';
import { marked } from 'marked';

interface MarkdownViewerProps {
  content: string;
}

/**
 * Sanitize and clean HTML output from marked parser.
 * Removes dangerous script/iframe tags and on* attributes while preserving safe HTML and formatting.
 */
function sanitizeAndProcessHtml(rawHtml: string): string {
  if (typeof window === 'undefined' || !window.DOMParser) {
    return rawHtml;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  // Remove dangerous executable or embedding tags
  const dangerousTags = [
    'script',
    'style',
    'iframe',
    'object',
    'embed',
    'form',
    'input',
    'button',
    'meta',
    'link',
    'applet',
  ];
  for (const tag of dangerousTags) {
    doc.querySelectorAll(tag).forEach((el) => el.remove());
  }

  // Sanitize all elements & attributes
  const allElements = doc.querySelectorAll('*');
  allElements.forEach((el) => {
    // Strip on* event handlers (onclick, onload, onerror, etc.)
    const attrNames = Array.from(el.attributes).map((a) => a.name);
    for (const name of attrNames) {
      if (name.toLowerCase().startsWith('on')) {
        el.removeAttribute(name);
      }
    }

    const tagName = el.tagName.toLowerCase();

    // Secure anchor links
    if (tagName === 'a') {
      const href = el.getAttribute('href') || '';
      const cleanHref = href.trim().toLowerCase();
      if (
        cleanHref.startsWith('javascript:') ||
        cleanHref.startsWith('vbscript:') ||
        cleanHref.startsWith('data:text/html')
      ) {
        el.removeAttribute('href');
      } else {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
    }

    // Secure image tags
    if (tagName === 'img') {
      const src = el.getAttribute('src') || '';
      const cleanSrc = src.trim().toLowerCase();
      if (
        cleanSrc.startsWith('javascript:') ||
        cleanSrc.startsWith('vbscript:') ||
        cleanSrc.startsWith('data:text/html')
      ) {
        el.removeAttribute('src');
      }
      el.setAttribute('loading', 'lazy');
    }
  });

  return doc.body.innerHTML;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content }) => {
  if (!content || !content.trim()) {
    return (
      <div className="text-nordic-muted text-xs italic py-4">
        Tidak ada deskripsi detail yang disediakan oleh pembuat proyek.
      </div>
    );
  }

  const cleanHtml = useMemo(() => {
    try {
      // 1. Strip raw HTML comments
      const preProcessed = content.replace(/<!--[\s\S]*?-->/g, '');

      // 2. Parse Markdown + inline HTML using marked (GFM enabled)
      const parsed = marked.parse(preProcessed, {
        async: false,
        breaks: true,
        gfm: true,
      }) as string;

      // 3. Sanitize and secure output
      return sanitizeAndProcessHtml(parsed);
    } catch (err) {
      console.error('Failed to parse markdown:', err);
      return `<p>${content}</p>`;
    }
  }, [content]);

  // Intercept link clicks to open in default OS browser via Electron shell
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest('a');
    if (target && target.href) {
      e.preventDefault();
      window.open(target.href, '_blank');
    }
  };

  return (
    <div
      onClick={handleClick}
      className="markdown-body text-xs text-nordic-text leading-relaxed select-text"
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
    />
  );
};
