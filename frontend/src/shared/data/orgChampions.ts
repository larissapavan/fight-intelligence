import { compareDivisions } from './orgFormat'
import type { OrgEvent } from '../types/api'

export interface OrgTitleDefense {
  opponent: string
  date: string | null
  eventName: string
  method: string | null
  round: number | null
  outcome: 'win' | 'draw_nc'
}

export interface OrgTitleReign {
  division: string
  reignOrder: number
  fighterReignIndex: number
  champion: string
  opponent: string
  date: string | null
  eventName: string
  method: string | null
  round: number | null
  stage: string | null
  interim: boolean
  isFinal: boolean
  defenses: OrgTitleDefense[]
}

export interface GreatestOrgChampion {
  champion: string
  divisions: string[]
  reignsCount: number
  defensesCount: number
  titleWinsCount: number
  isCurrentOrFinal: boolean
  firstTitleDate: string | null
  lastTitleDate: string | null
  reigns: OrgTitleReign[]
}

export function compactNameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .sort()
    .join('')
}

export function buildDivisionReigns(
  events: OrgEvent[],
  finalChampionByDivision: Map<string, string | null>,
): Map<string, OrgTitleReign[]> {
  const titleBouts: { event: OrgEvent; fight: OrgEvent['fights'][number]; cardOrder: number }[] = []
  for (const event of events) {
    event.fights.forEach((fight, index) => {
      if (fight.title_fight && fight.weight_class) {
        titleBouts.push({ event, fight, cardOrder: index })
      }
    })
  }

  // Chronological order: oldest event first; within the same card, prelims/co-main (higher index) before main event (index 0).
  titleBouts.sort((a, b) => (a.event.date ?? '').localeCompare(b.event.date ?? '') || b.cardOrder - a.cardOrder)

  const byDivision = new Map<string, OrgTitleReign[]>()
  const undisputedByDiv = new Map<string, OrgTitleReign>()
  const interimByDiv = new Map<string, OrgTitleReign>()
  const fighterReignCounts = new Map<string, number>()

  for (const { event, fight } of titleBouts) {
    const division = fight.weight_class!
    const isInterim = (fight.stage ?? '').toLowerCase().includes('interim')
    const winner = fight.winner
    const list = byDivision.get(division) ?? []
    if (!byDivision.has(division)) byDivision.set(division, list)

    if (!winner) {
      // Draw or No Contest in a title fight: the defending champion retains the belt
      const active = isInterim ? interimByDiv.get(division) : undisputedByDiv.get(division)
      if (active) {
        const opp = compactNameKey(active.champion) === compactNameKey(fight.fighter_1) ? fight.fighter_2 : fight.fighter_1
        active.defenses.push({
          opponent: opp,
          date: event.date,
          eventName: event.name,
          method: fight.method,
          round: fight.round,
          outcome: 'draw_nc',
        })
      }
      continue
    }

    const opponent = compactNameKey(winner) === compactNameKey(fight.fighter_1) ? fight.fighter_2 : fight.fighter_1
    const active = isInterim ? interimByDiv.get(division) : undisputedByDiv.get(division)

    if (active && compactNameKey(active.champion) === compactNameKey(winner)) {
      active.defenses.push({
        opponent,
        date: event.date,
        eventName: event.name,
        method: fight.method,
        round: fight.round,
        outcome: 'win',
      })
      const currentInterim = interimByDiv.get(division)
      if (!isInterim && currentInterim && compactNameKey(currentInterim.champion) === compactNameKey(opponent)) {
        interimByDiv.delete(division)
      }
    } else {
      const fighterKey = `${division}:${compactNameKey(winner)}`
      const nextCount = isInterim ? 1 : (fighterReignCounts.get(fighterKey) ?? 0) + 1
      if (!isInterim) fighterReignCounts.set(fighterKey, nextCount)
      const undisputedOrder = list.filter((r) => !r.interim).length + 1

      const reign: OrgTitleReign = {
        division,
        reignOrder: isInterim ? 0 : undisputedOrder,
        fighterReignIndex: nextCount,
        champion: winner,
        opponent,
        date: event.date,
        eventName: event.name,
        method: fight.method,
        round: fight.round,
        stage: fight.stage ?? null,
        interim: isInterim,
        isFinal: false,
        defenses: [],
      }
      list.push(reign)

      if (isInterim) {
        interimByDiv.set(division, reign)
      } else {
        undisputedByDiv.set(division, reign)
        const currentInterim = interimByDiv.get(division)
        if (currentInterim && compactNameKey(currentInterim.champion) === compactNameKey(winner)) {
          interimByDiv.delete(division)
        }
      }
    }
  }

  for (const [division, list] of byDivision.entries()) {
    const finalChamp = finalChampionByDivision.get(division)
    const lastUndisputed = [...list].reverse().find((r) => !r.interim)
    if (lastUndisputed && finalChamp && compactNameKey(lastUndisputed.champion) === compactNameKey(finalChamp)) {
      lastUndisputed.isFinal = true
    }
  }

  return byDivision
}

export function buildGreatestOrgChampions(
  reignsByDivision: Map<string, OrgTitleReign[]>,
  finalChampionByDivision: Map<string, string | null>,
): GreatestOrgChampion[] {
  const byFighter = new Map<
    string,
    {
      champion: string
      divisions: Set<string>
      reignsCount: number
      defensesCount: number
      isCurrentOrFinal: boolean
      dates: string[]
      reigns: OrgTitleReign[]
    }
  >()

  const currentChampKeys = new Set<string>()
  for (const champ of finalChampionByDivision.values()) {
    if (champ) currentChampKeys.add(compactNameKey(champ))
  }

  for (const [division, reigns] of reignsByDivision.entries()) {
    for (const reign of reigns) {
      const key = compactNameKey(reign.champion)
      let entry = byFighter.get(key)
      if (!entry) {
        entry = {
          champion: reign.champion,
          divisions: new Set<string>(),
          reignsCount: 0,
          defensesCount: 0,
          isCurrentOrFinal: currentChampKeys.has(key) || reign.isFinal,
          dates: [],
          reigns: [],
        }
        byFighter.set(key, entry)
      }
      entry.divisions.add(division)
      entry.reignsCount += 1
      const winDefenses = reign.defenses.filter((d) => d.outcome === 'win')
      entry.defensesCount += winDefenses.length
      if (reign.isFinal) entry.isCurrentOrFinal = true
      if (reign.date) entry.dates.push(reign.date)
      for (const d of winDefenses) {
        if (d.date) entry.dates.push(d.date)
      }
      entry.reigns.push(reign)
    }
  }

  const result: GreatestOrgChampion[] = []
  for (const item of byFighter.values()) {
    const sortedDates = [...item.dates].sort()
    const divisions = Array.from(item.divisions).sort(compareDivisions)
    result.push({
      champion: item.champion,
      divisions,
      reignsCount: item.reignsCount,
      defensesCount: item.defensesCount,
      titleWinsCount: item.reignsCount + item.defensesCount,
      isCurrentOrFinal: item.isCurrentOrFinal,
      firstTitleDate: sortedDates[0] ?? null,
      lastTitleDate: sortedDates[sortedDates.length - 1] ?? null,
      reigns: item.reigns,
    })
  }

  result.sort(
    (a, b) =>
      b.titleWinsCount - a.titleWinsCount ||
      b.defensesCount - a.defensesCount ||
      b.divisions.length - a.divisions.length ||
      b.reignsCount - a.reignsCount ||
      a.champion.localeCompare(b.champion),
  )

  return result
}
