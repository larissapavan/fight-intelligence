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
      className={`relative grid ${className} shrink-0 place-items-center overflow-hidden rounded-lg border bg-gradient-to-br from-[#D32F2F]/30 to-[var(--avatar-bg)] ${
        highlight
          ? 'border-[#E5A93C]/70 shadow-[0_0_0_1px_rgba(211,47,47,0.35)]'
          : 'border-neutral-700/60'
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
        <span className="type-display text-sm font-bold uppercase text-[#FF6B6B]" aria-hidden="true">
          {initials}
        </span>
      )}
    </span>
  )
}
