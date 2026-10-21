import { Check, Link2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // No clipboard API (older browsers, an insecure origin): fall back to a hidden field and the copy command.
    const field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.opacity = '0'
    document.body.appendChild(field)
    field.select()
    try {
      return document.execCommand('copy')
    } catch {
      return false
    } finally {
      document.body.removeChild(field)
    }
  }
}

/** Copies a link to the clipboard; `href` is relative to the site (e.g. "/matchup-intelligence?a=..."). */
export function CopyLinkButton({ href, label = 'Copy link', className = '' }: { href: string; label?: string; className?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = async () => {
    const ok = await copyText(new URL(href, window.location.origin).toString())
    setState(ok ? 'copied' : 'failed')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setState('idle'), 2200)
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={`ghost-action theme-text inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] ${className}`}
    >
      {state === 'copied' ? <Check className="h-4 w-4" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
      <span role="status">{state === 'copied' ? 'Link copied' : state === 'failed' ? 'Copy failed' : label}</span>
    </button>
  )
}
