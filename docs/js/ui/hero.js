// The fighter. An original chibi-style SVG whose hair, aura and build change with your tier.
import { html } from './core.js'

const HAIR = {
  0: 'M60 46 L52 30 L64 38 L66 22 L76 34 L84 18 L90 34 L102 24 L100 40 L112 34 L104 50 Z',
  2: 'M56 50 L40 26 L62 36 L60 10 L76 30 L84 4 L92 30 L110 10 L106 36 L128 26 L110 52 Z',
  4: 'M54 52 L30 24 L60 34 L52 2 L74 28 L84 -6 L94 28 L118 2 L108 34 L140 22 L114 54 Z',
}
const hairFor = idx => (idx >= 4 ? HAIR[4] : idx >= 2 ? HAIR[2] : HAIR[0])

export function Fighter({ tier, size = 180, charging = false }) {
  const idx = tier.idx
  const bulk = 1 + Math.min(idx, 6) * 0.06
  const aura = tier.aura
  return html`<svg class=${'fighter' + (charging ? ' charging' : '')} viewBox="0 0 168 200" width=${size} height=${size * 200 / 168} role="img" aria-label=${'Your fighter, tier ' + tier.name}>
    <defs>
      <radialGradient id="auraGrad" cx="50%" cy="60%" r="55%">
        <stop offset="0%" stop-color=${aura || 'transparent'} stop-opacity="0.85" />
        <stop offset="70%" stop-color=${aura || 'transparent'} stop-opacity="0.25" />
        <stop offset="100%" stop-color=${aura || 'transparent'} stop-opacity="0" />
      </radialGradient>
    </defs>
    ${aura && html`<g class="aura">
      <ellipse cx="84" cy="118" rx=${58 + idx * 3} ry=${86 + idx * 3} fill="url(#auraGrad)" />
      <path class="flame f1" d="M34 170 Q24 110 50 60 Q48 100 62 120 Z" fill=${aura} opacity="0.45" />
      <path class="flame f2" d="M134 170 Q144 110 118 60 Q120 100 106 120 Z" fill=${aura} opacity="0.45" />
      <path class="flame f3" d="M84 10 Q70 40 78 70 L90 70 Q98 40 84 10 Z" fill=${aura} opacity="0.35" />
    </g>`}
    ${tier.sparks && html`<g class="sparks" stroke=${aura} stroke-width="2.5" fill="none" stroke-linecap="round">
      <path d="M26 92 l10 6 -6 4 10 8" /><path d="M140 70 l-9 7 6 3 -10 9" /><path d="M130 150 l-8 -6 5 -3 -9 -7" />
    </g>`}
    <g class="body" transform=${`translate(84 0) scale(${bulk} 1) translate(-84 0)`}>
      <path d="M54 186 L60 150 L72 150 L74 186 Z M94 186 L96 150 L108 150 L114 186 Z" fill="var(--fighter-pants)" />
      <path d="M56 150 Q52 108 62 96 L106 96 Q116 108 112 150 Z" fill="var(--fighter-gi)" />
      <path d="M72 96 L84 124 L96 96 Z" fill="var(--fighter-skin)" />
      <rect x="58" y="138" width="52" height="7" rx="2" fill="var(--fighter-belt)" />
      <path d="M62 98 Q40 110 40 132 L52 134 Q54 116 66 110 Z" fill="var(--fighter-gi)" />
      <path d="M106 98 Q128 110 128 132 L116 134 Q114 116 102 110 Z" fill="var(--fighter-gi)" />
      <circle cx="44" cy="136" r="9" fill="var(--fighter-skin)" /><circle cx="124" cy="136" r="9" fill="var(--fighter-skin)" />
    </g>
    <g class="head">
      <rect x="76" y="80" width="16" height="16" fill="var(--fighter-skin)" />
      <ellipse cx="84" cy="62" rx="26" ry="28" fill="var(--fighter-skin)" />
      <path d=${hairFor(idx)} fill=${tier.hair} stroke="rgba(0,0,0,.25)" stroke-width="1" />
      <rect x="58" y="50" width="52" height="7" rx="2" fill="var(--fighter-band)" />
      <path d="M108 52 Q122 58 126 70 Q116 62 106 58 Z" fill="var(--fighter-band)" />
      <path d="M70 66 L80 64 M88 64 L98 66" stroke="#1d1a17" stroke-width="2.4" stroke-linecap="round" />
      <ellipse cx="75" cy="71" rx="3" ry=${idx >= 2 ? 3.4 : 2.6} fill=${idx >= 5 ? aura : '#1d1a17'} />
      <ellipse cx="93" cy="71" rx="3" ry=${idx >= 2 ? 3.4 : 2.6} fill=${idx >= 5 ? aura : '#1d1a17'} />
      <path d=${idx >= 2 ? 'M78 82 Q84 86 90 82' : 'M79 82 L89 82'} stroke="#1d1a17" stroke-width="2" fill="none" stroke-linecap="round" />
    </g>
  </svg>`
}

export function PowerCard({ level, tier, onTap }) {
  const pct = Math.round(tier.progress * 100)
  return html`<section class="power-card" onClick=${onTap}>
    <div class="power-fighter"><${Fighter} tier=${tier} size=${150} /></div>
    <div class="power-info">
      <p class="eyebrow">Power level</p>
      <p class="power-num">${level.toLocaleString()}</p>
      <p class="tier-name">${tier.name}</p>
      ${tier.next ? html`
        <div class="meter" role="progressbar" aria-valuenow=${pct} aria-valuemin="0" aria-valuemax="100" aria-label="Progress to next tier"><span style=${{ width: pct + '%' }}></span></div>
        <p class="muted small">${(tier.next.min - level).toLocaleString()} to <b>${tier.next.name}</b></p>`
        : html`<p class="muted small">Max tier. Nothing left but volcanoes.</p>`}
    </div>
  </section>`
}
