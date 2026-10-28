import { Check, Link2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { L } from '../../i18n/lang'

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
export function CopyLinkButton({ href, label, className = '' }: { href: string; label?: string; className?: string }) {
  const { i18n } = useTranslation()
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = async () => {
    const ok = await copyText(new URL(href, window.location.origin).toString())
    setState(ok ? 'copied' : 'failed')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setState('idle'), 2200)
  }

  const idleLabel = label ?? L(i18n.language, 'Copiar link', 'Copy link', 'Copier le lien')
  const copiedLabel = L(i18n.language, 'Link copiado', 'Link copied', 'Lien copié')
  const failedLabel = L(i18n.language, 'Falha ao copiar', 'Copy failed', 'Échec de la copie')

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={`ghost-action theme-text inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] ${className}`}
    >
      {state === 'copied' ? <Check className="h-4 w-4" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
      <span role="status">{state === 'copied' ? copiedLabel : state === 'failed' ? failedLabel : idleLabel}</span>
    </button>
  )
}
