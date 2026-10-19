// Drag to reorder: hold the grip on a row and slide it up or down; the others make room and it
// drops where you let go. Works with touch, mouse and pen. Arrow buttons stay as the
// accessible way to do the same thing.
import { html, useState, useRef, Icon } from './core.js'
import { dropIndex, shiftFor } from '../reorder.js'

const EDGE = 70 // px from the top or bottom of the screen where dragging scrolls

/** useDragSort(onMove) → { itemProps(i), gripProps(i, label), dragging } */
export function useDragSort(onMove) {
  const [drag, setDrag] = useState(null) // { from, to, dy, size }
  const st = useRef(null)
  const els = useRef([])
  const scroller = el => {
    for (let p = el?.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY
      if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p
    }
    return document.scrollingElement
  }
  const update = clientY => {
    const s = st.current
    if (!s) return
    const scrolled = s.box.scrollTop - s.scroll0
    const dy = clientY - s.y0 + scrolled
    const to = dropIndex(s.mids, s.from, s.mids[s.from] + dy)
    setDrag({ from: s.from, to, dy, size: s.size })
    s.to = to
  }
  const tick = () => {
    const s = st.current
    if (!s) return
    const v = s.lastY < EDGE ? -8 : s.lastY > innerHeight - EDGE ? 8 : 0
    if (v) { s.box.scrollTop += v; update(s.lastY) }
    s.raf = requestAnimationFrame(tick)
  }
  const end = commit => {
    const s = st.current
    st.current = null
    if (s) cancelAnimationFrame(s.raf)
    setDrag(null)
    if (commit && s && s.to !== s.from) onMove(s.from, s.to)
  }
  const gripProps = (i, label) => ({
    class: 'drag-grip',
    'aria-label': label,
    title: 'Drag to move',
    onPointerDown: e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      e.preventDefault()
      // Rows removed since the last drag leave empty slots at the end; ignore them.
      let n = els.current.length
      while (n && !els.current[n - 1]) n--
      const rects = els.current.slice(0, n).map(el => el?.getBoundingClientRect())
      if (!rects[i]) return
      const box = scroller(els.current[i])
      const mids = rects.map(r => (r ? r.top + r.height / 2 : 0))
      // Room to make = the spacing between neighbours (row height plus any gap).
      const size = mids[i + 1] != null && rects[i + 1] ? mids[i + 1] - mids[i] : mids[i - 1] != null && rects[i - 1] ? mids[i] - mids[i - 1] : rects[i].height
      st.current = { from: i, to: i, y0: e.clientY, lastY: e.clientY, mids, size, box, scroll0: box.scrollTop }
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
      setDrag({ from: i, to: i, dy: 0, size: st.current.size })
      st.current.raf = requestAnimationFrame(tick)
    },
    onPointerMove: e => { if (st.current) { st.current.lastY = e.clientY; update(e.clientY) } },
    onPointerUp: () => end(true),
    onPointerCancel: () => end(false),
    onKeyDown: e => { if (e.key === 'Escape') end(false) },
  })
  const itemProps = i => ({
    ref: el => { els.current[i] = el },
    class: drag ? (drag.from === i ? ' is-dragging' : ' is-shifting') : '',
    style: drag ? { transform: `translateY(${drag.from === i ? drag.dy : shiftFor(i, drag.from, drag.to, drag.size)}px)` } : null,
  })
  return { itemProps, gripProps, dragging: !!drag }
}

export const Grip = ({ props }) => html`<button type="button" ...${props}><${Icon} name="grip" size=${18} /></button>`
