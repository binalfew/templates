/** @type {Array<() => void>} */
const hooks = [];

/** @param {() => void} hook */
export function onShutdown(hook) {
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
