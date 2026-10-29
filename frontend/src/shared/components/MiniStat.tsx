export function MiniStat({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="metric-tile min-h-[58px] rounded-xl px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        <span className="type-tech text-[11px] uppercase tracking-[0.14em]">{label}</span>
      </div>
      <p className="type-num mt-1 truncate text-xs font-semibold text-[var(--text-main)]">{value}</p>
    </div>
  )
}
