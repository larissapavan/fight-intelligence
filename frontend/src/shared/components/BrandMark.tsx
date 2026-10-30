import { useTheme } from '../context/ThemeContext'

/**
 * Vektor MMA brand mark: authentic octagonal cage with black & red / white & red vector arrow.
 */
export function BrandMark({ className = '' }: { className?: string }) {
  const { isLight } = useTheme()
  return (
    <img
      src={isLight ? '/vektor-symbol-light.png?v=4' : '/vektor-symbol-dark.png?v=4'}
      alt="Vektor MMA"
      className={`select-none object-contain ${className}`}
      draggable={false}
      aria-hidden="true"
    />
  )
}
