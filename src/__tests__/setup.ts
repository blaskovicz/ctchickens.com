import { config } from '@vue/test-utils';
import { createBootstrap } from 'bootstrap-vue-next';
import { vi } from 'vitest';

config.global.plugins = [createBootstrap()];

// Globally mock useToast
vi.mock('bootstrap-vue-next', async () => {
  const actual = await vi.importActual('bootstrap-vue-next');
  return {
    ...actual as any,
    useToast: () => ({
      show: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      create: vi.fn(),
    })
  };
});
