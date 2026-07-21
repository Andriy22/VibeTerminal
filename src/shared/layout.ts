/**
 * Split n panes into rows.
 * Auto (cols null): at most 2 columns so agent TUIs keep their width —
 * 4 → 2×2, 6 → 3 rows of 2; odd counts put full rows first (5 → [2, 2, 1]).
 * Explicit cols: rows fill to that width, remainder last (cols 3, n 4 → [3, 1]).
 */
export function gridRows(n: number, cols?: number | null): number[] {
  if (n <= 0) return []
  const fixed = cols && cols > 0 ? Math.min(Math.floor(cols), n) : null
  if (fixed) {
    const rows = Math.ceil(n / fixed)
    return Array.from({ length: rows }, (_, i) =>
      i < rows - 1 ? fixed : n - fixed * (rows - 1)
    )
  }
  const rows = Math.ceil(n / 2)
  const base = Math.floor(n / rows)
  const extra = n % rows
  return Array.from({ length: rows }, (_, i) => (i < extra ? base + 1 : base))
}

/** Map a flat pane index to its [row, col] position for the gridRows layout. */
export function paneposition(
  n: number,
  index: number,
  cols?: number | null
): { row: number; col: number } {
  const rows = gridRows(n, cols)
  let remaining = index
  for (let row = 0; row < rows.length; row++) {
    if (remaining < rows[row]) return { row, col: remaining }
    remaining -= rows[row]
  }
  return { row: rows.length - 1, col: 0 }
}
