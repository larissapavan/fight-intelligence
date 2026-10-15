import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-3 py-8">
      <div className="surface-card w-full max-w-md rounded-[20px] p-5 text-center">
        <div className="mx-auto inline-flex rounded-xl bg-[#C8102E]/10 p-3 text-[var(--accent-red)]">
          <Compass className="h-6 w-6" />
        </div>
        <p className="data-value mt-3 text-5xl font-bold text-[#FFFFFF]">404</p>
        <h1 className="mt-2 text-2xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">Page not found</h1>
        <p className="mt-2 text-sm leading-6 text-[#999999]">
          The page you're looking for doesn't exist or may have moved.
        </p>
        <Link
          to="/"
          className="primary-action mx-auto mt-4 inline-flex w-fit items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-white"
        >
          Back to home
        </Link>
      </div>
    </div>
  )
}
