import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useBreederUtils } from '../useBreederUtils';
import { isSameDay, formatDateDivider } from '../useBreederUtils';

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

describe('isSameDay', () => {
  it('is true for the same calendar day at different times', () => {
    expect(isSameDay(new Date('2026-03-05T01:00:00'), new Date('2026-03-05T23:30:00'))).toBe(true);
  });

  it('is false across a day boundary', () => {
    expect(isSameDay(new Date('2026-03-05T23:59:00'), new Date('2026-03-06T00:00:01'))).toBe(false);
  });

  it('is false for the same month/day in different years', () => {
    expect(isSameDay(new Date('2025-03-05T12:00:00'), new Date('2026-03-05T12:00:00'))).toBe(false);
  });
});

describe('formatDateDivider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-05T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('labels the current day as "Today"', () => {
    expect(formatDateDivider(new Date('2026-03-05T08:00:00'))).toBe('Today');
  });

  it('labels the prior day as "Yesterday"', () => {
    expect(formatDateDivider(new Date('2026-03-04T23:00:00'))).toBe('Yesterday');
  });

  it('omits the year for an older date within the current year', () => {
    expect(formatDateDivider(new Date('2026-01-10T12:00:00'))).toBe('January 10');
  });

  it('includes the year for a date in a prior year', () => {
    expect(formatDateDivider(new Date('2025-11-20T12:00:00'))).toBe('November 20, 2025');
  });
});
