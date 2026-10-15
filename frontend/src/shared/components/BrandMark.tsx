/**
 * Fight Intelligence mark: an ink octagon (the cage) with a hard red offset shadow, carrying an italic FI monogram
 * (cream F, red I). Decorative; the wordmark names the link. Geometry is mirrored in public/favicon.svg and
 * scripts/generate_brand_assets.py.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden="true" focusable="false">
      <path d="M11.54 1H26.46L37 11.54V26.46L26.46 37H11.54L1 26.46V11.54Z" transform="translate(2 2)" fill="#C8102E" />
      <path d="M11.54 1H26.46L37 11.54V26.46L26.46 37H11.54L1 26.46V11.54Z" fill="#0E0E0E" />
      <path d="M8.5 29L12.1 11H25.1L24.26 15.2H15.86L15.28 18.1H22.08L21.28 22.1H14.48L13.1 29Z" fill="#F6F1E4" />
      <path d="M26.9 11H31.5L27.9 29H23.3Z" fill="#C8102E" />
    </svg>
  )
}
