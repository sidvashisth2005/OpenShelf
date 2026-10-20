export async function register() {
  // Reports to the Super Admin panel when this install is configured for it (Node.js runtime only).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startPanelAgent } = await import("./server/panel/agent");
    startPanelAgent();
  }
}
