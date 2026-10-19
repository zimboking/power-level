// Flat illustrations of the things in power.js LIFTED_LADDER, for the end-of-workout screen and the
// share card. Plain SVG strings with fixed colours (no CSS variables), so the same drawing works
// inline in both themes and when drawn onto a canvas for sharing. viewBox 0 0 160 100, ground at y 92.
const G = '<ellipse cx="80" cy="93" rx="64" ry="4" fill="#000" opacity=".18"/>'

const ART = {
  dumbbell: `<rect x="34" y="40" width="14" height="36" rx="4" fill="#4b5563"/><rect x="112" y="40" width="14" height="36" rx="4" fill="#4b5563"/>
    <rect x="24" y="46" width="10" height="24" rx="3" fill="#6b7280"/><rect x="126" y="46" width="10" height="24" rx="3" fill="#6b7280"/>
    <rect x="48" y="54" width="64" height="8" rx="4" fill="#9ca3af"/>`,
  fridge: `<rect x="54" y="8" width="52" height="84" rx="7" fill="#e5e7eb" stroke="#9ca3af" stroke-width="2"/>
    <line x1="54" y1="38" x2="106" y2="38" stroke="#9ca3af" stroke-width="2"/><rect x="96" y="16" width="4" height="14" rx="2" fill="#6b7280"/>
    <rect x="96" y="46" width="4" height="22" rx="2" fill="#6b7280"/><circle cx="66" cy="22" r="3" fill="#f87171"/><rect x="62" y="52" width="10" height="7" rx="1.5" fill="#fbbf24"/>`,
  piano: `<path d="M22 44 Q22 30 40 30 L92 30 Q110 30 116 40 Q128 44 138 44 L138 58 L22 58 Z" fill="#1f2937" stroke="#6b7280" stroke-width="1.5"/>
    <rect x="22" y="56" width="116" height="7" fill="#111827"/><rect x="26" y="58" width="44" height="4" fill="#f9fafb"/>
    ${[30, 36, 42, 48, 54, 60, 66].map(x => `<rect x="${x}" y="58" width="2.5" height="3" fill="#111827"/>`).join('')}
    <path d="M40 30 L70 6 L74 8 L50 30 Z" fill="#374151"/><rect x="30" y="63" width="5" height="29" fill="#1f2937"/><rect x="124" y="63" width="5" height="29" fill="#1f2937"/><rect x="76" y="63" width="5" height="22" fill="#1f2937"/>`,
  cow: `<rect x="40" y="38" width="76" height="34" rx="14" fill="#f9fafb" stroke="#d1d5db" stroke-width="1.5"/>
    <path d="M58 40 q8 10 2 22 q-10 -2 -12 -14z M92 44 q10 2 10 14 q-8 4 -14 -4z" fill="#1f2937"/>
    <rect x="112" y="30" width="26" height="24" rx="9" fill="#f9fafb" stroke="#d1d5db" stroke-width="1.5"/><rect x="124" y="42" width="16" height="12" rx="5" fill="#fbcfe8"/>
    <path d="M114 30 l-6 -8 M136 30 l6 -8" stroke="#a16207" stroke-width="3" stroke-linecap="round"/><circle cx="120" cy="38" r="2" fill="#111827"/>
    ${[46, 58, 96, 108].map(x => `<rect x="${x}" y="68" width="7" height="24" rx="2" fill="#f9fafb" stroke="#d1d5db"/>`).join('')}<path d="M40 44 q-10 6 -8 20" stroke="#6b7280" stroke-width="2" fill="none"/>`,
  car: `<path d="M18 70 Q18 54 34 52 L52 36 Q58 30 70 30 L104 30 Q114 30 120 38 L132 52 Q144 54 144 66 L144 76 L18 76 Z" fill="#ef4444"/>
    <path d="M56 40 Q60 36 68 36 L84 36 L84 52 L46 52 Z M90 36 L104 36 Q110 36 114 42 L122 52 L90 52 Z" fill="#bfdbfe"/>
    <circle cx="46" cy="78" r="13" fill="#111827"/><circle cx="46" cy="78" r="5" fill="#9ca3af"/><circle cx="118" cy="78" r="13" fill="#111827"/><circle cx="118" cy="78" r="5" fill="#9ca3af"/>
    <rect x="136" y="60" width="8" height="5" rx="2" fill="#fde68a"/>`,
  elephant: `<ellipse cx="80" cy="52" rx="44" ry="28" fill="#9ca3af"/><circle cx="122" cy="44" r="20" fill="#9ca3af"/>
    <path d="M136 52 Q146 66 140 82 Q136 88 132 84 Q138 70 128 58 Z" fill="#9ca3af"/><ellipse cx="112" cy="44" rx="13" ry="17" fill="#6b7280"/>
    <circle cx="128" cy="40" r="2.5" fill="#111827"/><path d="M130 58 q8 4 12 0" stroke="#f3f4f6" stroke-width="3" stroke-linecap="round" fill="none"/>
    ${[48, 66, 92, 108].map(x => `<rect x="${x}" y="70" width="13" height="22" rx="3" fill="#9ca3af"/>`).join('')}<path d="M36 46 q-8 4 -6 14" stroke="#6b7280" stroke-width="2.5" fill="none"/>`,
  trex: `<path d="M20 70 Q50 60 66 48 Q74 30 92 26 L116 24 Q132 22 134 34 L134 44 Q130 50 118 48 L110 48 Q100 60 96 70 Q90 84 76 82 Q50 80 20 70 Z" fill="#16a34a"/>
    <path d="M118 48 L132 46 L130 52 L116 54 Z" fill="#15803d"/><circle cx="122" cy="32" r="2.5" fill="#111827"/>
    <path d="M100 54 l8 6 l-3 2" stroke="#15803d" stroke-width="3.5" stroke-linecap="round" fill="none"/>
    <rect x="70" y="76" width="9" height="16" rx="2" fill="#15803d"/><rect x="86" y="72" width="9" height="20" rx="2" fill="#15803d"/>
    <path d="M118 34 l3 3 l3 -3 l3 3 l3 -3" stroke="#f9fafb" stroke-width="1.5" fill="none"/>`,
  bus: `<rect x="14" y="26" width="132" height="52" rx="8" fill="#facc15"/><rect x="14" y="56" width="132" height="5" fill="#1f2937"/>
    ${[22, 44, 66, 88, 110].map(x => `<rect x="${x}" y="32" width="18" height="18" rx="2" fill="#bfdbfe"/>`).join('')}<rect x="132" y="32" width="10" height="22" rx="2" fill="#bfdbfe"/>
    <circle cx="40" cy="80" r="11" fill="#111827"/><circle cx="40" cy="80" r="4" fill="#9ca3af"/><circle cx="120" cy="80" r="11" fill="#111827"/><circle cx="120" cy="80" r="4" fill="#9ca3af"/>`,
  tank: `<rect x="22" y="62" width="116" height="24" rx="12" fill="#3f6212"/>${[34, 50, 66, 82, 98, 114, 128].map(x => `<circle cx="${x}" cy="74" r="6" fill="#1a2e05"/>`).join('')}
    <path d="M30 62 L40 48 L122 48 L134 62 Z" fill="#4d7c0f"/><path d="M58 48 L66 34 L104 34 L112 48 Z" fill="#65a30d"/><rect x="104" y="38" width="52" height="6" rx="2" fill="#4d7c0f"/>`,
  whale: `<path d="M12 60 Q20 34 60 34 Q104 34 128 50 Q140 56 150 46 L154 40 L152 58 Q156 66 150 72 L144 64 Q130 74 100 76 Q40 80 12 60 Z" fill="#2563eb"/>
    <path d="M20 62 Q60 74 104 70" stroke="#93c5fd" stroke-width="2" fill="none"/><circle cx="36" cy="50" r="2.5" fill="#0f172a"/>
    <path d="M60 68 q6 12 18 12 q-6 -8 -6 -14 z" fill="#1d4ed8"/><path d="M50 30 q-2 -12 4 -18 M50 30 q4 -10 12 -12" stroke="#93c5fd" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  jet: `<path d="M8 56 Q8 48 20 48 L136 48 Q152 50 154 56 Q152 62 136 64 L20 64 Q8 64 8 56 Z" fill="#f3f4f6" stroke="#9ca3af" stroke-width="1.5"/>
    <path d="M62 56 L100 22 L110 22 L88 56 Z M62 58 L100 92 L110 92 L88 58 Z" fill="#cbd5e1"/><path d="M18 48 L10 26 L20 26 L34 48 Z" fill="#cbd5e1"/>
    ${[40, 50, 60, 104, 114, 124].map(x => `<circle cx="${x}" cy="54" r="2" fill="#60a5fa"/>`).join('')}<path d="M138 50 q10 2 12 6 l-12 0 z" fill="#60a5fa"/>`,
  shuttle: `<rect x="64" y="20" width="22" height="70" rx="11" fill="#f97316"/><path d="M64 31 Q75 8 86 31 Z" fill="#ea580c"/>
    <rect x="50" y="30" width="10" height="58" rx="5" fill="#f3f4f6" stroke="#d1d5db"/><path d="M50 32 Q55 18 60 32 Z" fill="#f3f4f6" stroke="#d1d5db"/>
    <rect x="90" y="30" width="10" height="58" rx="5" fill="#f3f4f6" stroke="#d1d5db"/><path d="M90 32 Q95 18 100 32 Z" fill="#f3f4f6" stroke="#d1d5db"/>
    <path d="M86 44 L100 44 L112 72 L112 84 L86 84 Z" fill="#f9fafb" stroke="#9ca3af"/><path d="M98 84 L112 84 L106 92 Z" fill="#fbbf24"/>`,
  eiffel: `<path d="M80 6 L84 26 L76 26 Z" fill="#78350f"/><path d="M76 26 L84 26 L92 54 L68 54 Z" fill="#92400e"/>
    <path d="M66 54 L94 54 L118 92 L102 92 Q80 66 58 92 L42 92 Z" fill="#92400e"/><rect x="62" y="52" width="36" height="5" fill="#78350f"/>
    <rect x="72" y="24" width="16" height="4" fill="#78350f"/><path d="M70 32 L90 46 M90 32 L70 46 M60 62 L100 78 M100 62 L60 78" stroke="#b45309" stroke-width="1.2"/>`,
  pyramid: `<path d="M80 12 L150 90 L10 90 Z" fill="#fcd34d"/><path d="M80 12 L150 90 L96 90 Z" fill="#f59e0b"/>
    ${[30, 48, 66].map(y => `<path d="M${80 - (y - 12) * 0.9} ${y} L${80 + (y - 12) * 0.9} ${y}" stroke="#d97706" stroke-width="1"/>`).join('')}`,
  volcano: `<path d="M8 90 L58 30 Q80 22 102 30 L152 90 Z" fill="#78350f"/><path d="M58 30 Q80 22 102 30 L96 38 Q80 32 64 38 Z" fill="#ef4444"/>
    <path d="M70 34 Q66 52 72 64 Q76 50 78 36 Z M88 34 Q96 50 90 70 Q86 52 82 36 Z" fill="#f97316"/>
    <circle cx="66" cy="16" r="9" fill="#9ca3af" opacity=".8"/><circle cx="82" cy="8" r="11" fill="#9ca3af" opacity=".7"/><circle cx="98" cy="16" r="8" fill="#9ca3af" opacity=".6"/>`,
}

/** The drawing for a LIFTED_LADDER item (by its `art` key), or a dumbbell. Returns SVG markup. */
export function liftedSvg(art, { width = 160, height = 100 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100" width="${width}" height="${height}">${G}${ART[art] || ART.dumbbell}</svg>`
}
export const ART_KEYS = Object.keys(ART)
