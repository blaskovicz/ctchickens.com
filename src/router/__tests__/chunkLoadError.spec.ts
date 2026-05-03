import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { onChunkLoadError } from '../index';

vi.mock('../../firebase', () => ({ trackEvent: vi.fn() }));

describe('onChunkLoadError', () => {
  let reloadSpy: ReturnType<typeof vi.fn>;
  let mockLocation: { reload: ReturnType<typeof vi.fn>; hash: string };

  beforeEach(() => {
    sessionStorage.clear();
    reloadSpy = vi.fn();
    mockLocation = { reload: reloadSpy, hash: '' };
    vi.stubGlobal('location', mockLocation);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets guard, updates hash, and reloads on chunk load error', () => {
    onChunkLoadError(
      new Error('Failed to fetch dynamically imported module: /assets/ClassifiedDetailView-ZZtoPKkr.js'),
      { fullPath: '/classified/abc123' }
    );
    expect(sessionStorage.getItem('chunk-error-reload')).toBe('1');
    expect(mockLocation.hash).toBe('/classified/abc123');
    expect(reloadSpy).toHaveBeenCalledOnce();
  });

  it('does not reload when guard is set — prevents infinite loop', () => {
    sessionStorage.setItem('chunk-error-reload', '1');
    onChunkLoadError(
      new Error('Failed to fetch dynamically imported module: /assets/Foo.js'),
      { fullPath: '/classified/abc123' }
    );
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('ignores non-chunk errors', () => {
    onChunkLoadError(new Error('some unrelated runtime error'), { fullPath: '/' });
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('chunk-error-reload')).toBeNull();
  });

  it('detects "Importing a module script failed" variant', () => {
    onChunkLoadError(
      new Error('Importing a module script failed.'),
      { fullPath: '/inbox' }
    );
    expect(reloadSpy).toHaveBeenCalledOnce();
  });
});
