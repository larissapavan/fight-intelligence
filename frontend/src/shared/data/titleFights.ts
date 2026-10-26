export type FighterTitleRef = {
  name: string
  belt?: boolean | null
  division?: string | null
}

export interface TitleFightInfo {
  title_fight: boolean
  interim_title: boolean
  weight_class: string
}

export function getMatchupTitleFight(
  fighterA?: FighterTitleRef | null,
  fighterB?: FighterTitleRef | null,
): TitleFightInfo | null {
  if (!fighterA || !fighterB) return null
  const pair = [fighterA.name.trim().toLowerCase(), fighterB.name.trim().toLowerCase()].sort().join('|')

  if (pair === 'carlos prates|michael morales') {
    return { title_fight: true, interim_title: true, weight_class: 'Welterweight' }
  }
  if (pair === 'merab dvalishvili|petr yan') {
    return { title_fight: true, interim_title: false, weight_class: 'Bantamweight' }
  }
  if (pair === 'alexander volkanovski|movsar evloev') {
    return { title_fight: true, interim_title: false, weight_class: 'Featherweight' }
  }
  if (pair === 'ciryl gane|josh hokit') {
    return { title_fight: true, interim_title: false, weight_class: 'Heavyweight' }
  }
  if (pair === 'amanda nunes|kayla harrison') {
    return { title_fight: true, interim_title: false, weight_class: "Women's Bantamweight" }
  }
  if (pair === 'joshua van|manel kape') {
    return { title_fight: true, interim_title: false, weight_class: 'Flyweight' }
  }
  if (fighterA.belt && fighterA.division && fighterA.division === fighterB.division) {
    return { title_fight: true, interim_title: false, weight_class: fighterA.division }
  }
  if (fighterB.belt && fighterB.division && fighterB.division === fighterA.division) {
    return { title_fight: true, interim_title: false, weight_class: fighterB.division }
  }
  return null
}
