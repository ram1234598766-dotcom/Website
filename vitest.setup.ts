import '@testing-library/jest-dom/vitest';

// jsdom does not implement matchMedia which xterm.js requires.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// CodeMirror 6 calls Range.getClientRects() during editor measurement; jsdom
// does not implement it.  Return an empty rect list so the editor can mount.
if (typeof Range !== 'undefined') {
  const mockGetClientRects = () => ({
    length: 0,
    item: (_index: number) => null,
    [Symbol.iterator]: function* () { yield* []; },
  });
  Range.prototype.getClientRects = mockGetClientRects as any;
  Range.prototype.getBoundingClientRect = () => ({
    x: 0, y: 0, bottom: 0, height: 0, left: 0, right: 0,
    top: 0, width: 0, toJSON: () => ({}),
  }) as any;
}

// user-event v14 requires the document to be prepared before userEvent.setup()
// is called.  The inline implementation below mirrors the internal logic of
// @testing-library/user-event's prepareDocument.
const isPrepared = Symbol('Node prepared with document state workarounds');
function prepareElement(el: Element) {
  if ((el as any)[isPrepared]) return;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    // Intercept value/selection/range mutations so user-event can track state.
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype, 'value'
    ) || Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype, 'value'
    );
    if (descriptor && descriptor.set && !(el as any)._ueValueIntercepted) {
      (el as any)._ueValueIntercepted = true;
      let _val = (el as HTMLInputElement).value;
      Object.defineProperty(el, 'value', {
        get() { return _val; },
        set(v: string) {
          const old = _val;
          _val = v;
          if (old !== v) {
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        },
        configurable: true,
        enumerable: true,
      });
    }
  }
  (el as any)[isPrepared] = isPrepared;
}
if (typeof document !== 'undefined') {
  document.addEventListener('focus', (e: Event) => {
    prepareElement(e.target as Element);
  }, { capture: true, passive: true });
  if (document.activeElement) {
    prepareElement(document.activeElement);
  }
  document.addEventListener('blur', (e: Event) => {
    const el = e.target as HTMLInputElement;
    // Track initial value for change detection
  }, { capture: true, passive: true });
  (document as any)[isPrepared] = isPrepared;
}

// jsdom has no Worker — stub a minimal one before CloudOS mounts.
class MockWorker {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: ErrorEvent) => void) | null = null;
  postMessage(_msg: unknown) {}
  terminate() { this.onmessage = null; this.onerror = null; }
}

(globalThis as any).Worker = MockWorker as any;

// CloudOS collapses its sidebar on small viewports.  jsdom defaults to a tiny
// layout, so force a desktop-sized innerWidth/innerHeight so tests can find
// the file tree and tabs.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
}

// CloudOS collapses its sidebar on small viewports.  jsdom defaults to a tiny
// layout, so force a desktop-sized innerWidth/innerHeight so tests can find
// the file tree and tabs.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
}
