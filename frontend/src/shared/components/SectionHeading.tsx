interface SectionHeadingProps {
  eyebrow: string
  title: string
  description?: string
  /** 1 for the page's own title (one per page), 2 for a section inside it. */
  level?: 1 | 2
}

export function SectionHeading({ eyebrow, title, description, level = 2 }: SectionHeadingProps) {
  const Heading = level === 1 ? 'h1' : 'h2'
  return (
    <div>
      <p className="broadcast-label text-[11px] text-[var(--text-muted)]">{eyebrow}</p>
      <Heading className="title-chamfer mt-1.5 text-2xl font-black uppercase tracking-wide text-[#FFFFFF] md:text-3xl">{title}</Heading>
      {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[#999999]">{description}</p> : null}
    </div>
  )
}
