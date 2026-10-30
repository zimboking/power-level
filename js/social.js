// Crews: what gets shared with your mates, worked out from the log on this phone. No network
// here (see social-api.js), so it can be tested. Only what's built here ever leaves the phone:
// never notes, body weight, food or water.
import { workoutVolume, currentE1rm } from './strength.js'
import { powerLevel, tierFor } from './power.js'
import { streakWeeks } from './stats.js'
import { prNamesFor } from './records.js'
import { exInfo } from './exercises.js'
import { addDays, weekOf } from './schedule.js'

export const SHARE_LIFTS = ['bench', 'squat', 'deadlift', 'ohp']
export const REACTIONS = { fist: { emoji: '👊', label: 'Fist bump' }, fire: { emoji: '🔥', label: 'On fire' }, strong: { emoji: '💪', label: 'Strong' } }
export const AVATARS = ['💪', '🏋️', '🦍', '🐻', '🦁', '🐺', '🔥', '⚡', '🦘', '🐨', '🥩', '🍗']
// Workouts from the last two weeks are kept in step with the feed (new, edited, deleted).
export const SYNC_DAYS = 14

const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/
// Codes skip I, O, 0 and 1 so they read clearly off a phone.
export const cleanCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
export const validCode = s => CODE_RE.test(String(s || ''))
export const crewLink = (pageUrl, code) => `${String(pageUrl).split('#')[0]}#crew=${code}`
export const codeFromHash = hash => { const m = /^#?crew=([A-Za-z0-9]{6})$/.exec(hash || ''); return m && validCode(m[1].toUpperCase()) ? m[1].toUpperCase() : null }

export const cleanName = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 30)
export const validName = s => cleanName(s).length >= 1

const r1 = v => Math.round(v * 10) / 10

/** The feed post for one finished workout. */
export function postFor(w, workouts) {
  const work = (w.entries || []).map(e => ({ e, sets: (e.sets || []).filter(s => !s.warmup) })).filter(x => x.sets.length)
  return {
    client_id: String(w.id).slice(0, 40),
    done_on: w.date,
    title: String(w.name || 'Workout').slice(0, 60) || 'Workout',
    summary: {
      minutes: Math.max(0, Math.round(w.durationMin || 0)),
      sets: work.reduce((n, x) => n + x.sets.length, 0),
      volume: Math.round(workoutVolume(w)),
      exercises: work.map(x => exInfo(x.e.exId).name.slice(0, 40)).slice(0, 10),
      prs: prNamesFor(workouts, w).map(n => n.slice(0, 40)).slice(0, 8),
    },
  }
}

/** Posts for the workouts done in the last SYNC_DAYS days, as of todayIso. */
export function recentPosts(workouts, todayIso) {
  const from = addDays(todayIso, -SYNC_DAYS)
  return workouts.filter(w => w.date >= from && w.date <= todayIso && (w.entries || []).length).map(w => postFor(w, workouts))
}

/** Your public profile numbers. Lift numbers only when you share them. */
export function profileStats(state, todayIso, { shareLifts = true } = {}) {
  const ws = state.workouts || []
  const weekStart = state.profile?.plan?.weekStart ?? 1
  const level = powerLevel(ws)
  const week = new Set(weekOf(todayIso, weekStart))
  const lifts = {}
  if (shareLifts) for (const id of SHARE_LIFTS) { const v = currentE1rm(ws, id); if (v > 0) lifts[id] = r1(v) }
  return {
    power_level: Math.min(10_000_000, Math.max(0, level)),
    tier: tierFor(level).name,
    streak_weeks: Math.min(1000, streakWeeks(ws, todayIso, weekStart)),
    week_sessions: Math.min(50, ws.filter(w => week.has(w.date)).length),
    total_sessions: Math.min(100_000, ws.length),
    lifts: shareLifts ? lifts : null,
  }
}

export const LEADERBOARDS = {
  power: { label: 'Power', value: p => p.power_level, show: p => p.power_level.toLocaleString() },
  week: { label: 'Week', value: p => p.week_sessions, show: p => `${p.week_sessions} session${p.week_sessions === 1 ? '' : 's'}` },
  streak: { label: 'Streak', value: p => p.streak_weeks, show: p => `${p.streak_weeks} wk` },
}

/** Profiles ranked for a board, best first; ties share a place. */
export function leaderboard(profiles, by = 'power') {
  const val = (LEADERBOARDS[by] || LEADERBOARDS.power).value
  const sorted = [...profiles].sort((a, b) => val(b) - val(a) || a.display_name.localeCompare(b.display_name))
  let place = 0, prev = null
  return sorted.map((p, i) => { if (val(p) !== prev) { place = i + 1; prev = val(p) } return { ...p, place } })
}

/** Reaction rows for one post → { kind: { count, mine } }. */
export function reactionSummary(rows, postId, me) {
  const out = Object.fromEntries(Object.keys(REACTIONS).map(k => [k, { count: 0, mine: false }]))
  for (const r of rows) if (r.post_id === postId && out[r.kind]) { out[r.kind].count++; if (r.user_id === me) out[r.kind].mine = true }
  return out
}

/** A friendly line for a feed post. */
export function postLine(summary) {
  const bits = []
  if (summary.sets) bits.push(`${summary.sets} sets`)
  if (summary.volume) bits.push(`${summary.volume.toLocaleString()} kg moved`)
  if (summary.minutes) bits.push(`${summary.minutes} min`)
  return bits.join(' · ')
}
