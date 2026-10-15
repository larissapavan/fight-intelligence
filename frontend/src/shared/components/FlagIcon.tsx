import { useState } from 'react'

type FlagIconProps = {
  /** Lowercase flag code from the API: ISO 3166-1 alpha-2 ("br") or a UK nation ("gb-eng"). */
  code: string | null | undefined
  country?: string | null
  className?: string
}

/**
 * Country flag as a small image. Flag emoji are not used because Windows renders them as two letters.
 * Images come from flagcdn.com; if one fails to load the flag is simply hidden.
 */
export function FlagIcon({ code, country, className = 'h-3.5 w-[21px]' }: FlagIconProps) {
  const [failed, setFailed] = useState(false)
  if (!code || failed) return null
  const label = country ? `Flag of ${country}` : 'Country flag'

  return (
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      srcSet={`https://flagcdn.com/w40/${code}.png 1x, https://flagcdn.com/w80/${code}.png 2x`}
      alt={label}
      title={country ?? undefined}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`inline-block shrink-0 rounded-[3px] border border-white/15 object-cover ${className}`}
    />
  )
}
