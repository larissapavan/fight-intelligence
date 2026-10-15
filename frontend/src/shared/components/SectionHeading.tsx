interface SectionHeadingProps {
  eyebrow: string
  title: string
  description?: string
}

export function SectionHeading({ eyebrow, title, description }: SectionHeadingProps) {
  return (
    <div>
      <p className="broadcast-label text-[11px] text-[var(--text-muted)]">{eyebrow}</p>
      <h2 className="title-chamfer mt-1.5 text-2xl font-black uppercase tracking-wide text-[#FFFFFF] md:text-3xl">{title}</h2>
      {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[#999999]">{description}</p> : null}
    </div>
  )
}
