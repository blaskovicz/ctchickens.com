import { marked, Renderer } from 'marked';
import DOMPurify from 'dompurify';

const renderer = new Renderer();
renderer.link = ({ href, text }) =>
  `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;

marked.use({ breaks: true, renderer });

function enforceExternalLinks(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  div.querySelectorAll('a').forEach(a => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });
  return div.innerHTML;
}

export function renderMessage(text: string): string {
  const raw = text.split('\n').map(line => marked.parseInline(line) as string).join('<br>');
  return enforceExternalLinks(
    DOMPurify.sanitize(raw, { ALLOWED_TAGS: ['a', 'strong', 'em', 'code', 'br'], ALLOWED_ATTR: ['href', 'target', 'rel'] })
  );
}

export function renderBreederDescription(text: string): string {
  const raw = marked.parse(text) as string;
  return enforceExternalLinks(
    DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: ['a', 'strong', 'em', 'code', 'br', 'p', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    })
  );
}

export function stripMarkdown(text: string): string {
  const raw = marked.parseInline(text) as string;
  const sanitized = DOMPurify.sanitize(raw, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  const el = document.createElement('div');
  el.innerHTML = sanitized;
  return el.textContent || '';
}
