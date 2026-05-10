// Vitest jsdom environment polyfills required by Radix primitives.
// jsdom lacks ResizeObserver / DOMRect / hasPointerCapture / scrollIntoView used internally
// by @radix-ui/react-use-size and Popover positioning. We stub them so component tests can
// render Radix Portals without crashing.

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}

// Radix Popover sometimes calls hasPointerCapture / setPointerCapture / releasePointerCapture
// during open transitions; jsdom does not implement them.
if (typeof Element !== 'undefined') {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {}
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {}
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
}
