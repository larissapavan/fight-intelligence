import { useId } from 'react'

/** Small gold championship-belt icon shown next to the name of a current champion. */
export function ChampionBelt({ className = 'h-[18px] w-[18px]' }: { className?: string }) {
  const gradientId = useId()
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label="Current Champion"
      className={`shrink-0 ${className}`}
      style={{ filter: 'drop-shadow(0 0 4px rgba(255, 215, 0, 0.4))' }}
    >
      <title>Current Champion</title>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFE680" />
          <stop offset="0.5" stopColor="#FFD700" />
          <stop offset="1" stopColor="#C98A1B" />
        </linearGradient>
      </defs>
      {/* straps */}
      <rect x="0.8" y="9" width="22.4" height="6" rx="1.2" fill="#2B2110" stroke="#E5A93C" strokeWidth="0.8" />
      <path d="M3.5 12h3.2M17.3 12h3.2" stroke="#E5A93C" strokeWidth="0.9" strokeLinecap="round" strokeDasharray="0.1 1.6" />
      {/* centre plate */}
      <path
        d="M12 2.2 17.6 4.9 19.3 12 17.6 19.1 12 21.8 6.4 19.1 4.7 12 6.4 4.9Z"
        fill={`url(#${gradientId})`}
        stroke="#8A5A0C"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 5.2 15.6 6.9 16.7 12 15.6 17.1 12 18.8 8.4 17.1 7.3 12 8.4 6.9Z"
        fill="none"
        stroke="#8A5A0C"
        strokeWidth="0.7"
        strokeOpacity="0.8"
        strokeLinejoin="round"
      />
      {/* star */}
      <path
        d="m12 8.4 1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3Z"
        fill="#8A5A0C"
      />
    </svg>
  )
}
