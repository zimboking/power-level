// What happens after a set is ticked: how long to rest, and which superset partner is next.
// No UI here, so it can be tested.

const working = e => (e.sets || []).filter(s => !s.warmup)
const doneCount = e => working(e).filter(s => s.done).length
const hasOpenSet = e => working(e).some(s => !s.done)

/**
 * `entries` is the session before the tick; `i` is the exercise and `set` the set just ticked.
 * Returns { rest, next }: seconds to rest (null = go straight on) and the entry index to show next
 * (null = stay). In a superset the round goes on to any partner that still owes a set this round,
 * with no rest unless this exercise has its own rest time; once every partner has done the round,
 * the full rest starts and it's back to the first exercise.
 */
export function afterSet(entries, i, set, fallbackRest) {
  const entry = entries[i]
  const own = set.rest || (set.warmup ? null : entry.cfg?.rest) || null
  const full = own || (set.warmup ? 60 : fallbackRest)
  const members = entry.group ? entries.map((e, j) => ({ e, j })).filter(x => x.e.group === entry.group) : []
  if (members.length < 2) return { rest: full, next: null }
  const round = doneCount(entry) + (set.warmup ? 0 : 1)
  const owes = x => x.j !== i && doneCount(x.e) < round && hasOpenSet(x.e)
  const partner = members.find(x => x.j > i && owes(x)) || members.find(x => x.j < i && owes(x))
  if (partner && !set.warmup) return { rest: own, next: partner.j }
  if (set.warmup) return { rest: full, next: null }
  return { rest: full, next: members[0].j === i ? null : members[0].j }
}
