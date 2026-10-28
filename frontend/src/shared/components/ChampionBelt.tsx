import { useTranslation } from 'react-i18next'

import { L } from '../../i18n/lang'

/**
 * Championship belt shown next to the name of a current champion: an ink strap, two side plates and a big octagon
 * centre plate with a star. Flat colours with an ink outline, like the rest of the site (no glow). The icon is wider
 * than tall (2:1), so give it a height and a width twice as large.
 */
export function ChampionBelt({ className = 'h-[18px] w-9' }: { className?: string }) {
  const { i18n } = useTranslation()
  const label = L(i18n.language, 'Campeão Atual', 'Current Champion', 'Champion actuel')

  return (
    <svg viewBox="0 0 48 24" role="img" aria-label={label} className={`shrink-0 ${className}`}>
      <title>{label}</title>
      {/* strap */}
      <rect x="1" y="8.5" width="46" height="7" rx="1.5" fill="#0E0E0E" />
      <path d="M4 12H15M33 12H44" stroke="#F2C230" strokeWidth="0.9" strokeLinecap="round" strokeDasharray="0.1 1.9" />
      {/* side plates */}
      <rect x="4.6" y="7" width="7.4" height="10" rx="1.6" fill="#F2C230" stroke="#0E0E0E" strokeWidth="1.1" />
      <rect x="36" y="7" width="7.4" height="10" rx="1.6" fill="#F2C230" stroke="#0E0E0E" strokeWidth="1.1" />
      <circle cx="8.3" cy="12" r="1.5" fill="#0E0E0E" />
      <circle cx="39.7" cy="12" r="1.5" fill="#0E0E0E" />
      {/* centre plate */}
      <path
        d="M17.3 1.2H30.7L38.3 8.8V15.2L30.7 22.8H17.3L9.7 15.2V8.8Z"
        fill="#F2C230"
        stroke="#0E0E0E"
        strokeWidth="1.4"
        strokeLinejoin="miter"
      />
      <path d="M18.6 3.9H29.4L35.2 9.7V14.3L29.4 20.1H18.6L12.8 14.3V9.7Z" fill="#C99A12" stroke="#0E0E0E" strokeWidth="0.9" strokeLinejoin="miter" />
      {/* star */}
      <path d="m24 7 1.5 3.1 3.4.5-2.5 2.4.6 3.4-3-1.6-3 1.6.6-3.4-2.5-2.4 3.4-.5Z" fill="#0E0E0E" />
    </svg>
  )
}
