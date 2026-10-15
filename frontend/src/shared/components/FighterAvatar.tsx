import { useState } from 'react'

type FighterAvatarProps = {
  name: string
  imageUrl: string | null
  className?: string
  /** Gold/red ring for belt holders. */
  highlight?: boolean
}

/** Square headshot thumbnail with an initials fallback on a dark background. */
export function FighterAvatar({ name, imageUrl, className = 'h-14 w-14', highlight = false }: FighterAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const showImage = Boolean(imageUrl) && failedUrl !== imageUrl
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')

  return (
    <span
      className={`relative grid ${className} shrink-0 place-items-center overflow-hidden rounded-lg border-2 bg-[var(--avatar-bg)] ${
        highlight
          ? 'border-[#F2C230] shadow-[2px_2px_0_#0E0E0E]'
          : 'border-[var(--rule)]'
      }`}
    >
      {showImage ? (
        <img
          src={imageUrl ?? undefined}
          alt={name}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(imageUrl)}
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
      ) : (
        <span className="type-display text-sm font-bold uppercase text-[var(--accent-red)]" aria-hidden="true">
          {initials}
        </span>
      )}
    </span>
  )
}
