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
      <p className="font-mono text-[11px] font-medium tracking-widest uppercase text-[var(--text-secondary)]">{eyebrow}</p>
      <Heading className="mt-1 font-display font-extrabold uppercase tracking-tight text-2xl md:text-3xl lg:text-4xl text-[var(--text-main)]">{title}</Heading>
      {description ? <p className="mt-1.5 max-w-3xl font-sans text-xs md:text-sm leading-relaxed text-[var(--text-secondary)]">{description}</p> : null}
    </div>
  )
}
