import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Every test supplies its own fake API. Accidentally reaching production is forbidden.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Unmocked network request in test'))));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
