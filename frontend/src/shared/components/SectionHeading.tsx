interface SectionHeadingProps {
  eyebrow: string
  title: string
  description?: string
}

export function SectionHeading({ eyebrow, title, description }: SectionHeadingProps) {
  return (
    <div>
      <p className="broadcast-label text-[10px] text-[#999999]">{eyebrow}</p>
      <h2 className="mt-1.5 text-2xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF] md:text-3xl">{title}</h2>
      {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[#999999]">{description}</p> : null}
    </div>
  )
}
