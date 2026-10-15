const RED = '#E50914'
const GRAPHITE = '#4A4A52'

/** Fight Intelligence mark: a HUD-style octagon with a targeting crosshair. Decorative; the wordmark names the link. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden="true" focusable="false">
      <rect x="0.5" y="0.5" width="39" height="39" rx="9" fill="#0B0B0D" stroke="#FFFFFF" strokeOpacity="0.1" />

      {/* Octagon frame (graphite) with two red HUD corners on opposite diagonals */}
      <path
        d="M14.26 6.14 25.74 6.14 33.86 14.26 33.86 25.74 25.74 33.86 14.26 33.86 6.14 25.74 6.14 14.26Z"
        stroke={GRAPHITE}
        strokeWidth="1.2"
        strokeLinejoin="miter"
      />
      <path d="M6.14 14.26 14.26 6.14M33.86 25.74 25.74 33.86" stroke={RED} strokeWidth="1.5" strokeLinecap="square" />

      {/* Inner octagon */}
      <path
        d="M16.1 10.58 23.9 10.58 29.42 16.1 29.42 23.9 23.9 29.42 16.1 29.42 10.58 23.9 10.58 16.1Z"
        stroke="#2E2E34"
        strokeWidth="0.9"
      />

      {/* Crosshair with a gap around the centre, plus a pulsing core */}
      <path
        d="M11.5 20H16.4M23.6 20H28.5M20 11.5V16.4M20 23.6V28.5"
        stroke={RED}
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <circle cx="20" cy="20" r="2.7" stroke={RED} strokeWidth="1.1" />
      <circle cx="20" cy="20" r="0.9" fill={RED} className="animate-pulse" style={{ animationDuration: '2.4s' }} />
    </svg>
  )
}
