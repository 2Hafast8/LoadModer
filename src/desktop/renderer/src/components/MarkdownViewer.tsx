import React, { useMemo } from 'react';
import { marked } from 'marked';
import { useLanguage } from '../i18n/LanguageContext.js';

interface MarkdownViewerProps {
  content: string;
}

function sanitizeAndProcessHtml(rawHtml: string): string {
  if (typeof window === 'undefined' || !window.DOMParser) {
    return rawHtml;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

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

  const allElements = doc.querySelectorAll('*');
  allElements.forEach((el) => {
    const attrNames = Array.from(el.attributes).map((a) => a.name);
    for (const name of attrNames) {
      if (name.toLowerCase().startsWith('on')) {
        el.removeAttribute(name);
      }
    }

    const tagName = el.tagName.toLowerCase();

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
  const { t } = useLanguage();

  if (!content || !content.trim()) {
    return (
      <div className="text-nordic-muted text-xs italic py-4">
        {t.markdown.noDescription}
      </div>
    );
  }

  const cleanHtml = useMemo(() => {
    try {
      const preProcessed = content.replace(/<!--[\s\S]*?-->/g, '');
      const parsed = marked.parse(preProcessed, {
        async: false,
        breaks: true,
        gfm: true,
      }) as string;
      return sanitizeAndProcessHtml(parsed);
    } catch (err) {
      console.error('Failed to parse markdown:', err);
      return `<p>${content}</p>`;
    }
  }, [content]);

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
