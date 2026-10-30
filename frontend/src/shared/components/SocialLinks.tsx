import type { SVGProps } from 'react'

export const SOCIAL_LINKS = {
  youtube: {
    url: 'https://www.youtube.com/@Vektor-MMA',
    handle: '@Vektor-MMA',
    label: 'YouTube',
  },
  instagram: {
    url: 'https://www.instagram.com/vektormma',
    handle: '@vektormma',
    label: 'Instagram',
  },
  tiktok: {
    url: 'https://www.tiktok.com/@vektormma',
    handle: '@vektormma',
    label: 'TikTok',
  },
  github: {
    url: 'https://github.com/larissapavan/vektormma',
    handle: 'larissapavan/vektormma',
    label: 'GitHub',
  },
} as const

export function YouTubeIcon({ className = 'h-4 w-4', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className} {...props}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

export function InstagramIcon({ className = 'h-4 w-4', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  )
}

export function TikTokIcon({ className = 'h-4 w-4', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className} {...props}>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 3 15.68 6.34 6.34 0 0 0 9.35 22a6.33 6.33 0 0 0 6.34-6.32V9.08a8.28 8.28 0 0 0 4.84 1.57v-3.5a4.84 4.84 0 0 1-.94-.46z" />
    </svg>
  )
}

interface SocialLinksProps {
  className?: string
  iconClassName?: string
  showLabels?: boolean
}

export function SocialLinks({ className = 'flex items-center gap-1.5', iconClassName = 'h-4 w-4', showLabels = false }: SocialLinksProps) {
  const items = [
    {
      ...SOCIAL_LINKS.youtube,
      icon: YouTubeIcon,
      hoverColor: 'hover:text-[#FF0000] hover:bg-[#FF0000]/10',
    },
    {
      ...SOCIAL_LINKS.instagram,
      icon: InstagramIcon,
      hoverColor: 'hover:text-[#E4405F] hover:bg-[#E4405F]/10',
    },
    {
      ...SOCIAL_LINKS.tiktok,
      icon: TikTokIcon,
      hoverColor: 'hover:text-[#25F4EE] hover:bg-[#25F4EE]/10',
    },
  ]

  return (
    <div className={className}>
      {items.map((item) => {
        const Icon = item.icon
        return (
          <a
            key={item.label}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`${item.label} (${item.handle})`}
            title={`${item.label}: ${item.handle}`}
            className={`inline-flex items-center gap-1.5 rounded-lg p-1.5 text-[var(--text-secondary)] transition-colors duration-150 ${item.hoverColor} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8102E]`}
          >
            <Icon className={iconClassName} />
            {showLabels && <span className="font-mono text-xs font-semibold">{item.label}</span>}
          </a>
        )
      })}
    </div>
  )
}
