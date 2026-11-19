import { marked, Renderer } from 'marked';
import DOMPurify from 'dompurify';

const renderer = new Renderer();
renderer.link = ({ href, text }) =>
  `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;

marked.use({ breaks: true, renderer });

// marked's default GFM autolinker only recognizes bare URLs with a scheme
// (https://...) or a www. prefix — a bare "ctchickens.com/..." mention is
// left as plain text. This rewrites those into real markdown links first,
// without touching ones that already have a scheme or www. (those are
// already autolinked, and rewriting them again would double-wrap them).
const BARE_OWN_DOMAIN_RE = /(?<!:\/\/)(?<!www\.)(ctchickens\.com(?:\/[^\s<>()]*)?)/gi;
const TRAILING_PUNCTUATION_RE = /[.,!?;:'")\]]+$/;

function linkifyOwnDomain(text: string): string {
  return text.replace(BARE_OWN_DOMAIN_RE, (match) => {
    const trailing = match.match(TRAILING_PUNCTUATION_RE)?.[0] || '';
    const url = trailing ? match.slice(0, -trailing.length) : match;
    return `[${url}](https://${url})${trailing}`;
  });
}

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
  const linkified = linkifyOwnDomain(text);
  const raw = linkified.split('\n').map(line => marked.parseInline(line) as string).join('<br>');
  return enforceExternalLinks(
    DOMPurify.sanitize(raw, { ALLOWED_TAGS: ['a', 'strong', 'em', 'code', 'br'], ALLOWED_ATTR: ['href', 'target', 'rel'] })
  );
}

export function renderBreederDescription(text: string): string {
  const raw = marked.parse(linkifyOwnDomain(text)) as string;
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
