import { marked, Renderer } from 'marked';
import DOMPurify from 'dompurify';

const renderer = new Renderer();
renderer.link = ({ href, text }) =>
  `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;

marked.use({ breaks: true, renderer });

export function renderMessage(text: string): string {
  const raw = text.split('\n').map(line => marked.parseInline(line) as string).join('<br>');
  return DOMPurify.sanitize(raw, { ALLOWED_TAGS: ['a', 'strong', 'em', 'code', 'br'], ALLOWED_ATTR: ['href', 'target', 'rel'] });
}

export function stripMarkdown(text: string): string {
  const raw = marked.parseInline(text) as string;
  return DOMPurify.sanitize(raw, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}
