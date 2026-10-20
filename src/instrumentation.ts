export async function register() {
  // Reports to the Super Admin panel when this install is configured for it.
  // Runtime only: never during `next build` (Node.js runtime, not the build phase).
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build" && process.env.PANEL_URL) {
    const { startPanelAgent } = await import("./server/panel/agent");
    startPanelAgent();
  }
}
