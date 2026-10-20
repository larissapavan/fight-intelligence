interface LoadingSkeletonProps {
  className?: string
  label?: string
}

export function LoadingSkeleton({ className = 'h-24 w-full', label }: LoadingSkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-[24px] border border-white/8 bg-white/[0.055] ${className}`}
      role="status"
      aria-label={label ?? 'Loading'}
    />
  )
}
