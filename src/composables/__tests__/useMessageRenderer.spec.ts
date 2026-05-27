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
});
