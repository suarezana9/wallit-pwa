const SPACE_COLORS = ['#6c47ff', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#ef4444', '#14b8a6', '#8b5cf6'];

/** Color estable por grupo (el mismo id siempre da el mismo color), para reconocerlo de un vistazo. */
export function spaceColor(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return SPACE_COLORS[hash % SPACE_COLORS.length];
}
