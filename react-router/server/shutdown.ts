/** @type {Array<() => void>} */
const hooks: Array<() => void> = [];

export function onShutdown(hook: () => void) {
  hooks.push(hook);
}

export function runShutdownHooks() {
  for (const hook of hooks) {
    try {
      hook();
    } catch {
      // Best-effort cleanup
    }
  }
}
