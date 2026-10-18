// CapySpa's onsen: Capy soaks in a hot spring that fills as you drink. Ported from
// zimboking/Water-habit-app-2 (Apache 2.0). Scene colours are --cs-* tokens, so the light theme
// is a garden in daylight and the dark theme the same spring at dusk.
import { html } from './core.js'
import { stageFor, clamp } from '../water.js'

const RIM = { cx: 160, cy: 172, rx: 146, ry: 52 }
const STONE_FILLS = ['#a8a29e', '#d6d3d1', '#78716c']
const makeStones = (from, to, n) => Array.from({ length: n }, (_, i) => {
  const a = from + ((to - from) * i) / (n - 1)
  return { x: RIM.cx + RIM.rx * Math.cos(a), y: RIM.cy + RIM.ry * Math.sin(a), rx: 15 + ((i * 5) % 6), ry: 10 + ((i * 3) % 4), fill: STONE_FILLS[i % 3] }
})
const BACK_STONES = makeStones(Math.PI, 2 * Math.PI, 12)
const FRONT_STONES = makeStones(0, Math.PI, 13)
const FENCE_POLES = Array.from({ length: 21 }, (_, i) => i * 16)
const WAVE_PATH = (() => {
  let d = 'M -40 0'
  for (let i = 0; i < 24; i++) d += ` q 10 ${i % 2 === 0 ? -3.5 : 3.5} 20 0`
  return `${d} V 120 H -40 Z`
})()
const STEAM_X = [78, 232, 112, 262, 198, 56, 150]
const PUFFS = [[130, 64, -14, 7], [190, 64, 14, 7], [146, 46, -8, 5], [174, 46, 8, 5]]
const YUZU = [[100, 3, '0s'], [236, 0, '.6s'], [268, 4, '1.2s']]
const SPARKLES = [[48, 44, '0s'], [276, 40, '.7s'], [214, 22, '1.4s'], [98, 26, '1s']]
const STARS = [[30, 22], [70, 48], [128, 16], [196, 34], [250, 14], [292, 52]]
const SMOOTH = 'transform 1s cubic-bezier(.3,1.2,.5,1)'

const Towel = ({ drop }) => html`<g key=${'towel-' + drop} class=${drop ? 'cs-towel-drop' : undefined}><g transform="rotate(-7 160 60)">
  <rect x="134" y="54" width="52" height="15" rx="6" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" />
  <rect x="139" y="45" width="42" height="12" rx="5" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
  <line x1="139" y1="61.5" x2="181" y2="61.5" stroke="#7dd3fc" stroke-width="2" />
  <line x1="143" y1="51" x2="177" y2="51" stroke="#7dd3fc" stroke-width="1.5" /></g></g>`

const Turtle = () => html`<g transform="translate(158 44)"><g class="cs-turtle">
  <ellipse cx="-14" cy="2" rx="5" ry="3" fill="#84cc16" /><ellipse cx="13" cy="2" rx="5" ry="3" fill="#84cc16" />
  <circle cx="25" cy="-7" r="7" fill="#84cc16" stroke="#3f6212" stroke-width="1.2" /><circle cx="27.5" cy="-9" r="1.4" fill="#1f2937" />
  <path d="M26 -4.5 q2 1.5 4 0" fill="none" stroke="#3f6212" stroke-width="1" stroke-linecap="round" />
  <path d="M-20 0 Q-20 -22 0 -22 Q20 -22 20 0 Z" fill="#16a34a" stroke="#14532d" stroke-width="1.5" />
  <path d="M-9 -1 L-6 -12 L6 -12 L9 -1 M-6 -12 L0 -21 L6 -12" fill="none" stroke="#14532d" stroke-width="1.2" />
  <rect x="-22" y="-2" width="44" height="5" rx="2.5" fill="#65a30d" stroke="#14532d" stroke-width="1" /></g></g>`

function Capy({ stage, squish, towelDrop, onTap }) {
  return html`<g onClick=${onTap} style=${{ cursor: onTap ? 'pointer' : 'default' }} role=${onTap ? 'button' : undefined} aria-label=${onTap ? 'Tap Capy' : undefined}>
    <g class=${squish ? 'cs-squish' : towelDrop ? 'cs-towel-land' : 'cs-breathe'}>
      <ellipse cx="160" cy="166" rx="58" ry="46" fill="#a47148" /><ellipse cx="160" cy="178" rx="42" ry="30" fill="#b98556" />
      <ellipse cx="136" cy="150" rx="10" ry="7" fill="#8b5a33" /><ellipse cx="184" cy="150" rx="10" ry="7" fill="#8b5a33" />
      <ellipse cx="127" cy="70" rx="9" ry="7" fill="#7c4a26" /><ellipse cx="193" cy="70" rx="9" ry="7" fill="#7c4a26" />
      <rect x="120" y="64" width="80" height="72" rx="32" fill="#a47148" />
      <rect x="130" y="100" width="60" height="38" rx="19" fill="#8b5a33" />
      <ellipse cx="160" cy="110" rx="13" ry="6" fill="#3b2416" />
      <path d="M160 116 v5 M152 123 q8 5 16 0" fill="none" stroke="#3b2416" stroke-width="2.5" stroke-linecap="round" />
      <path d="M136 90 q7 -6 14 0 M170 90 q7 -6 14 0" fill="none" stroke="#2b1a0e" stroke-width="3" stroke-linecap="round" />
      <ellipse cx="133" cy="102" rx="7" ry="4" fill="#fb7185" opacity="0.4" /><ellipse cx="187" cy="102" rx="7" ry="4" fill="#fb7185" opacity="0.4" />
      ${stage >= 1 && html`<${Towel} drop=${towelDrop} />`}
      ${stage >= 3 && html`<${Turtle} />`}
    </g>
  </g>`
}

const Floaties = ({ waterY }) => html`<g style=${{ transform: `translateY(${waterY}px)`, transition: SMOOTH }}>
  <g transform="translate(62 0)"><g class="cs-bob">
    <path d="M-15 -6 q-4 -8 2 -7 l6 3 z" fill="#fde047" stroke="#eab308" stroke-width="1" />
    <ellipse cx="0" cy="-4" rx="14" ry="8.5" fill="#fde047" stroke="#eab308" stroke-width="1.2" />
    <circle cx="8" cy="-15" r="7" fill="#fde047" stroke="#eab308" stroke-width="1.2" />
    <path d="M14 -16 l7 2 l-7 3 z" fill="#f97316" /><circle cx="10" cy="-17" r="1.3" fill="#1f2937" />
    <path d="M-5 -6 q5 4 10 0" fill="none" stroke="#eab308" stroke-width="1.2" /></g></g>
  ${YUZU.map(([x, dy, delay]) => html`<g key=${x} transform=${`translate(${x} ${dy})`}><g class="cs-bob" style=${{ animationDelay: delay }}>
    <circle cx="0" cy="-3" r="9" fill="#facc15" stroke="#ca8a04" stroke-width="1.2" />
    <circle cx="-3" cy="-6" r="1" fill="#ca8a04" /><circle cx="3" cy="-1" r="1" fill="#ca8a04" />
    <ellipse cx="5" cy="-12" rx="5" ry="2.5" fill="#65a30d" transform="rotate(-30 5 -12)" /></g></g>`)}
</g>`

/** pct: share of today's goal. id must be unique per scene on the page (SVG ids). */
export function OnsenScene({ pct, id, compact = false, onTap, squish = false, towelDrop = 0 }) {
  const stage = stageFor(pct)
  const level = clamp(pct, 0, 100)
  const waterY = 198 - level * 0.48 // 198 (shallow) to 150 (neck deep)
  const ref = s => `${id}-${s}`
  const bodyHalf = y => { const t = (y - 166) / 46; return Math.abs(t) >= 1 ? 0 : 58 * Math.sqrt(1 - t * t) }
  const steamCount = compact ? 2 + stage : 3 + stage
  return html`<svg viewBox="0 0 320 240" class="onsen" role="img" aria-label=${`Capybara onsen at ${pct}% of today's goal`}>
    <defs>
      <linearGradient id=${ref('sky')} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style="stop-color: var(--cs-sky-1)" /><stop offset="100%" style="stop-color: var(--cs-sky-2)" /></linearGradient>
      <linearGradient id=${ref('gold')} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fde68a" /><stop offset="100%" stop-color="#fef9c3" /></linearGradient>
      <radialGradient id=${ref('glow')}><stop offset="0%" stop-color="#fde047" stop-opacity="0.95" /><stop offset="60%" stop-color="#facc15" stop-opacity="0.35" /><stop offset="100%" stop-color="#facc15" stop-opacity="0" /></radialGradient>
      <linearGradient id=${ref('water')} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7dd3fc" stop-opacity="0.88" /><stop offset="100%" stop-color="#0284c7" stop-opacity="0.95" /></linearGradient>
      <clipPath id=${ref('basin')}><ellipse cx="160" cy="174" rx="132" ry="44" /></clipPath>
    </defs>
    <rect width="320" height="240" fill=${`url(#${ref('sky')})`} />
    <rect width="320" height="240" fill=${`url(#${ref('gold')})`} style=${{ opacity: stage === 3 ? 'var(--cs-gold-sky)' : 0, transition: 'opacity 1s' }} />
    <g class="cs-night">${STARS.map(([x, y], i) => html`<circle key=${x} class="cs-twinkle" style=${{ animationDelay: `${i * 0.4}s` }} cx=${x} cy=${y} r="1.6" fill="#fef9c3" />`)}
      <circle cx="268" cy="34" r="13" fill="#fef3c7" /><circle cx="274" cy="30" r="11" style="fill: var(--cs-sky-1)" /></g>
    <path d="M0 120 L40 86 L78 108 L122 66 L170 102 L214 74 L262 100 L300 82 L320 94 V240 H0 Z" style="fill: var(--cs-hill)" />
    <g>${FENCE_POLES.map(x => html`<rect key=${x} x=${x + 2} y="92" width="12" height="60" rx="6" style="fill: var(--cs-fence); stroke: var(--cs-fence-edge)" stroke-width="1" />`)}
      <rect x="0" y="104" width="320" height="5" style="fill: var(--cs-fence-rail)" /><rect x="0" y="134" width="320" height="5" style="fill: var(--cs-fence-rail)" /></g>
    ${stage === 3 && html`<circle class="cs-glow" cx="160" cy="118" r="128" fill=${`url(#${ref('glow')})`} />`}
    <ellipse cx=${RIM.cx} cy=${RIM.cy} rx=${RIM.rx + 6} ry=${RIM.ry + 4} fill="#78716c" />
    <ellipse cx="160" cy="174" rx="132" ry="44" fill="#57534e" />
    ${BACK_STONES.map((s, i) => html`<ellipse key=${i} cx=${s.x} cy=${s.y} rx=${s.rx} ry=${s.ry} fill=${s.fill} stroke="#57534e" stroke-width="1.5" />`)}
    <rect x="296" y="96" width="10" height="70" rx="3" fill="#a16207" />
    <g><rect x="256" y="82" width="84" height="15" rx="7.5" fill="#84cc16" stroke="#4d7c0f" stroke-width="1.5" />
      <line x1="282" y1="82" x2="282" y2="97" stroke="#4d7c0f" stroke-width="2" /><line x1="310" y1="82" x2="310" y2="97" stroke="#4d7c0f" stroke-width="2" />
      <ellipse cx="257" cy="89.5" rx="4" ry="7" fill="#365314" /></g>
    ${stage === 3 && html`<path class="cs-pour" d="M255 92 Q244 98 243 116 L243 214" fill="none" stroke="#e0f2fe" stroke-width="5" stroke-linecap="round" stroke-dasharray="10 4" />`}
    <${Capy} stage=${stage} squish=${squish} towelDrop=${towelDrop} onTap=${onTap} />
    ${towelDrop > 0 && stage >= 1 && html`<g key=${'puff-' + towelDrop}>${PUFFS.map(([cx, cy, dx, r]) => html`<circle key=${cx} class="cs-puff" style=${{ '--dx': `${dx}px` }} cx=${cx} cy=${cy} r=${r} fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />`)}</g>`}
    <g clip-path=${`url(#${ref('basin')})`}><g style=${{ transform: `translateY(${waterY}px)`, transition: SMOOTH }}>
      <g class="cs-wave"><path d=${WAVE_PATH} fill=${`url(#${ref('water')})`} /></g>
      <ellipse cx="160" cy="1" rx=${bodyHalf(waterY) + 7} ry="6" fill="none" stroke="#f0f9ff" stroke-width="2" opacity="0.7" />
      <path d="M60 14 h26 M210 20 h32 M110 30 h20" stroke="#e0f2fe" stroke-width="2" stroke-linecap="round" opacity="0.6" />
      ${stage === 3 && html`<ellipse class="cs-ripple" cx="243" cy="2" rx="14" ry="4" fill="none" stroke="#f0f9ff" stroke-width="2" />`}
    </g></g>
    ${stage >= 2 && html`<${Floaties} waterY=${waterY} />`}
    ${FRONT_STONES.map((s, i) => html`<ellipse key=${i} cx=${s.x} cy=${s.y} rx=${s.rx + 2} ry=${s.ry} fill=${s.fill} stroke="#57534e" stroke-width="1.5" />`)}
    <g style=${{ transform: `translateY(${waterY - 6}px)`, transition: SMOOTH }}>${STEAM_X.slice(0, steamCount).map((x, i) => html`<g key=${x} transform=${`translate(${x} 0)`}>
      <path class="cs-steam" style=${{ animationDelay: `${i * 0.55}s` }} d="M0 0 q-6 -9 0 -18 q6 -9 0 -18" fill="none" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" /></g>`)}</g>
    ${stage === 3 && SPARKLES.map(([x, y, delay]) => html`<g key=${x} transform=${`translate(${x} ${y})`}><path class="cs-twinkle" style=${{ animationDelay: delay }} d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z" fill="#facc15" /></g>`)}
  </svg>`
}

/** Progress ring with the percentage in the middle; turns gold at the goal. */
export function CapyRing({ pct, size = 84 }) {
  const stroke = 8, r = (size - stroke) / 2, c = 2 * Math.PI * r
  const done = pct >= 100
  return html`<div class="cs-ring" style=${{ width: size + 'px', height: size + 'px' }}>
    <svg width=${size} height=${size} aria-hidden="true"><circle cx=${size / 2} cy=${size / 2} r=${r} fill="none" class="cs-ring-track" stroke-width=${stroke} />
      <circle cx=${size / 2} cy=${size / 2} r=${r} fill="none" class=${'cs-ring-fill' + (done ? ' done' : '')} stroke-width=${stroke} stroke-linecap="round"
        stroke-dasharray=${c} stroke-dashoffset=${c * (1 - clamp(pct, 0, 100) / 100)} /></svg>
    <div class="cs-ring-label"><b>${pct}%</b><small>${done ? 'zen' : 'of goal'}</small></div>
  </div>`
}
