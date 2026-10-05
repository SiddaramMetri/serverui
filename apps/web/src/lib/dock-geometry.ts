const icons = new Map<string, HTMLElement>();

export function registerDockIcon(id: string, node: HTMLElement | null) {
  if (node) icons.set(id, node);
  else icons.delete(id);
}

export function getDockIconRect(id: string): DOMRect | null {
  const node =
    icons.get(id) ??
    (typeof document === "undefined"
      ? null
      : document.querySelector<HTMLElement>(`[data-dock-icon="${id}"]`));
  if (!node) return null;
  return node.getBoundingClientRect();
}
