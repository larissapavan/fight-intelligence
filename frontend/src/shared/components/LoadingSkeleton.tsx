interface LoadingSkeletonProps {
  className?: string
  label?: string
}

export function LoadingSkeleton({ className = 'h-24 w-full', label }: LoadingSkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-[24px] border border-[var(--border-subtle)] bg-white/[0.055] ${className}`}
      role="status"
      aria-label={label ?? 'Loading'}
    />
  )
}
