import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

const createMemoryStorage = () => {
  let store = {};
  return {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

if (!globalThis.localStorage || typeof globalThis.localStorage.setItem !== 'function') {
  const memoryStorage = createMemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryStorage,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  cleanup();
  if (globalThis.localStorage && typeof globalThis.localStorage.clear === 'function') {
    globalThis.localStorage.clear();
  }
});

if (!globalThis.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}

    unobserve() {}

    disconnect() {}
  }

  globalThis.ResizeObserver = ResizeObserverMock;
}
