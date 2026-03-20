import { vi } from 'vitest';

// Re-export common mocks
export const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
};

export const mockSession = {
  data: null,
  status: 'unauthenticated' as const,
};