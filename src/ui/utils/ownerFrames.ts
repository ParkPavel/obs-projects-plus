/** Short DOM tasks stay in their element's window and are cancelled with the editor. */
export function createOwnerFrames() {
  const pending = new Set<{ view: Window; id: number | null }>();
  let alive = true;
  const clear = () => { for (const job of pending) if (job.id !== null) job.view.cancelAnimationFrame(job.id); pending.clear(); };
  return {
    schedule(node: HTMLElement, task: () => void): void {
      const view = node.ownerDocument.defaultView;
      if (!alive || !view) return;
      const job = { view, id: null as number | null }; pending.add(job);
      job.id = view.requestAnimationFrame(() => {
        if (!pending.delete(job) || !alive || !node.isConnected || node.ownerDocument.defaultView !== view) return;
        task();
      });
    },
    clear,
    destroy(): void { alive = false; clear(); },
  };
}
