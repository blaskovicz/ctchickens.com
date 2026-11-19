import { describe, it, expect } from 'vitest';
import { renderBreederDescription, renderMessage } from '../useMessageRenderer';

describe('renderBreederDescription', () => {
  it('renders bold markdown', () => {
    const result = renderBreederDescription('**Silkies**');
    expect(result).toContain('<strong>Silkies</strong>');
  });

  it('renders an unordered list', () => {
    const result = renderBreederDescription('- Silkies\n- Marans');
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>Silkies</li>');
    expect(result).toContain('<li>Marans</li>');
  });

  it('adds target and rel to markdown-syntax links', () => {
    const result = renderBreederDescription('[Visit](https://example.com)');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer"');
    expect(result).toContain('href="https://example.com"');
  });

  it('adds target and rel to raw HTML anchor tags', () => {
    const result = renderBreederDescription('<a href="https://example.com">hi</a>');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it('strips disallowed tags', () => {
    const result = renderBreederDescription('<script>alert("xss")</script>hello');
    expect(result).not.toContain('<script>');
    expect(result).toContain('hello');
  });

  it('strips disallowed attributes', () => {
    const result = renderBreederDescription('<a href="https://example.com" onclick="evil()">click</a>');
    expect(result).not.toContain('onclick');
  });
});

describe('renderMessage', () => {
  it('adds target and rel to raw HTML anchor tags', () => {
    const result = renderMessage('<a href="https://example.com">hi</a>');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it('renders inline bold', () => {
    const result = renderMessage('**bold**');
    expect(result).toContain('<strong>bold</strong>');
  });

  it('autolinks a bare ctchickens.com mention', () => {
    const result = renderMessage('check it out at ctchickens.com/#/directory/walkers-nest');
    expect(result).toContain('href="https://ctchickens.com/#/directory/walkers-nest"');
  });

  it('strips trailing punctuation from an autolinked bare mention', () => {
    const result = renderMessage('see ctchickens.com/#/directory/walkers-nest.');
    expect(result).toContain('href="https://ctchickens.com/#/directory/walkers-nest"');
    expect(result).toMatch(/<\/a>\.(\s|$)/);
  });

  it('does not double-wrap an already-schemed URL', () => {
    const result = renderMessage('visit https://ctchickens.com/#/directory/walkers-nest');
    expect((result.match(/<a /g) || []).length).toBe(1);
  });

  it('does not double-wrap a www.-prefixed mention', () => {
    const result = renderMessage('visit www.ctchickens.com');
    expect((result.match(/<a /g) || []).length).toBe(1);
  });
});
