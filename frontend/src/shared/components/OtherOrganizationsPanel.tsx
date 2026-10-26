import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getOtherOrganizations } from '../services/api'
import type { OtherOrganization } from '../types/api'
import { OrgFightLine } from './OrgFightLine'

const FIRST_SHOWN = 4

/**
 * What a UFC fighter did in the PFL or Bellator, under their UFC history. Nothing is drawn for a fighter who never
 * fought elsewhere, or while it loads or fails: it adds to a profile and is never needed by it. These fights are
 * shown, not counted: the UFC numbers above (record, trends, the model's inputs) stay what the UFC pipeline says.
 */
export function OtherOrganizationsPanel({ name }: { name: string }) {
  const { i18n } = useTranslation()
  const isPt = Boolean(i18n.language?.startsWith('pt'))
  const [found, setFound] = useState<OtherOrganization[]>([])

  useEffect(() => {
    let cancelled = false
    getOtherOrganizations(name)
      .then((data) => {
        if (!cancelled) setFound(data)
      })
      .catch((error) => console.error(error))
    return () => {
      cancelled = true
    }
  }, [name])

  if (found.length === 0) return null
  return (
    <section aria-label={isPt ? 'Lutas em outras organizações' : 'Fights in other organizations'} className="mt-3 space-y-3">
      {found.map((item) => (
        <OrgHistory key={item.org_id} item={item} isPt={isPt} />
      ))}
    </section>
  )
}

function OrgHistory({ item, isPt }: { item: OtherOrganization; isPt: boolean }) {
  const [all, setAll] = useState(false)
  const shown = all ? item.fights : item.fights.slice(0, FIRST_SHOWN)
  return (
    <div className="metric-tile rounded-2xl p-3">
      <p className="broadcast-label text-[11px] text-[#999999]">
        {isPt
          ? `Também lutou no ${item.short_name}${item.org_record ? ` · ${item.org_record} por lá` : ''}`
          : `Also fought in the ${item.short_name}${item.org_record ? ` · ${item.org_record} there` : ''}`}
      </p>
      <ul className="mt-2 space-y-2">
        {shown.map((fight) => (
          <OrgFightLine key={`${fight.fight_url}-${fight.opponent}`} fight={fight} knownOpponent={false} onSelect={() => undefined} />
        ))}
      </ul>
      {item.fights.length > FIRST_SHOWN ? (
        <button
          type="button"
          onClick={() => setAll((current) => !current)}
          aria-expanded={all}
          className="ghost-action mt-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#FFFFFF]"
        >
          {all
            ? (isPt ? 'Mostrar menos' : 'Show fewer')
            : (isPt ? `Mostrar todas as ${item.fights.length} lutas no ${item.short_name}` : `Show all ${item.fights.length} ${item.short_name} fights`)}
        </button>
      ) : null}
      <p className="theme-muted mt-2 text-[11px] leading-4">
        {isPt
          ? 'Exibido para contexto completo. O cartel, tendências e palpites do modelo acima consideram apenas lutas do UFC.'
          : 'Shown for the full picture. The UFC record, trends and the model\'s picks above count UFC fights only.'}
      </p>
    </div>
  )
}
