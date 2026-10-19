// Pure helpers for drag-to-reorder lists.

/** A copy of `list` with the item at `from` moved to `to`. */
export function moveItem(list, from, to) {
  if (from === to || from < 0 || from >= list.length) return list
  const next = [...list]
  const [it] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(next.length, to)), 0, it)
  return next
}

/**
 * Where a dragged item lands: `mids` are the vertical centres of the items as laid out before the
 * drag, `from` the dragged one and `y` the dragged item's current centre.
 */
export function dropIndex(mids, from, y) {
  let to = from
  for (let i = from + 1; i < mids.length; i++) if (y > mids[i]) to = i
  for (let i = from - 1; i >= 0; i--) if (y < mids[i]) to = i
  return to
}

/** How far the item at `i` shifts while `from` is dragged over `to` (by the dragged item's size). */
export function shiftFor(i, from, to, size) {
  if (i === from) return 0
  if (from < to && i > from && i <= to) return -size
  if (from > to && i < from && i >= to) return size
  return 0
}
