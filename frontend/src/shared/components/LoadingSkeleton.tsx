interface LoadingSkeletonProps {
  className?: string
}

export function LoadingSkeleton({ className = 'h-24 w-full' }: LoadingSkeletonProps) {
  return <div className={`animate-pulse rounded-[24px] border border-white/8 bg-white/[0.055] ${className}`} />
}
