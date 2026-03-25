import { describe, it, expect } from 'vitest';
import { useBreederUtils } from '../useBreederUtils';

describe('useBreederUtils', () => {
  const { formatContactLink } = useBreederUtils();

  describe('formatContactLink', () => {
    it('should handle raw email strings', () => {
      const input = 'cookscornerfarm.ct@gmail.com';
      const expected = 'mailto:cookscornerfarm.ct@gmail.com?subject=Inquiry%20from%20ctchickens.com';
      expect(formatContactLink(input)).toBe(expected);
    });

    it('should handle existing mailto links without subject', () => {
      const input = 'mailto:example@gmail.com';
      const expected = 'mailto:example@gmail.com?subject=Inquiry%20from%20ctchickens.com';
      expect(formatContactLink(input)).toBe(expected);
    });

    it('should correctly handle existing mailto links with other parameters', () => {
      const input = 'mailto:example@gmail.com?body=Hello';
      const expected = 'mailto:example@gmail.com?body=Hello&subject=Inquiry%20from%20ctchickens.com';
      expect(formatContactLink(input)).toBe(expected);
    });

    it('should not modify standard URLs', () => {
      const input = 'https://example.com';
      expect(formatContactLink(input)).toBe(input);
    });

    it('should not modify standard URLs with @ in them (e.g. social media handles)', () => {
      const input = 'https://facebook.com/username@something';
      expect(formatContactLink(input)).toBe(input);
    });

    it('should handle empty or null links', () => {
      expect(formatContactLink('')).toBe('');
    });
  });
});
