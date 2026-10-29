import { Flag, MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { L } from '../../i18n/lang'
import type { FighterProfile } from '../types/api'
import { nationalityText } from '../data/badges'

type FighterOriginProps = {
  fighter: Pick<FighterProfile, 'hometown' | 'country' | 'nationalities'>
  className?: string
}

/** Where the fighter comes from. Renders nothing when the data is not available for this fighter. */
export function FighterOrigin({ fighter, className = '' }: FighterOriginProps) {
  const { i18n } = useTranslation()

  const place = fighter.hometown ?? fighter.country
  const nationalities = nationalityText(fighter)
  if (!place && !nationalities) return null

  return (
    <ul className={`space-y-1 text-xs leading-5 text-[var(--text-secondary)] ${className}`}>
      {place ? (
        <li className="flex items-start gap-1.5">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
          <span className="min-w-0">
            <span className="sr-only">{L(i18n.language, 'Origem: ', 'From: ', 'Origine : ')}</span>
            {place}
          </span>
        </li>
      ) : null}
      {nationalities ? (
        <li className="flex items-start gap-1.5">
          <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
          <span className="min-w-0">
            <span className="sr-only">{L(i18n.language, 'Nacionalidades: ', 'Nationalities: ', 'Nationalités : ')}</span>
            {nationalities}
          </span>
        </li>
      ) : null}
    </ul>
  )
}
