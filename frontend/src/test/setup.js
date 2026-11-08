import '@testing-library/jest-dom';

// Polyfill localStorage for Node 21+ experimental localStorage conflict with jsdom
if (typeof window !== 'undefined') {
  const store = new Map();
  const storageMock = {
    getItem: (key) => (store.has(String(key)) ? store.get(String(key)) : null),
    setItem: (key, value) => {
      store.set(String(key), String(value));
    },
    removeItem: (key) => {
      store.delete(String(key));
    },
    clear: () => {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key: (i) => Array.from(store.keys())[i] ?? null,
  };

  try {
    Object.defineProperty(window, 'localStorage', {
      value: storageMock,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      value: storageMock,
      writable: true,
      configurable: true,
    });
  } catch (e) {
    // Fallback assignment if defineProperty fails
    window.localStorage = storageMock;
    globalThis.localStorage = storageMock;
  }
}
