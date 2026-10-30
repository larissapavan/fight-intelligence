export type OrgId = 'ufc' | 'pfl' | 'one' | 'bellator'

export type OrgSection = 'fighters' | 'events' | 'rankings' | 'gyms' | 'champions' | 'predictor'

export interface OrgConfig {
  id: OrgId
  name: string
  shortName: string
  /** URL prefix of the organization's pages: the UFC keeps the site root, every other organization gets its own. */
  basePath: string
  /** Where the data comes from, for the footer and the data note. */
  sourceName: string
  sourceUrl: string
  tagline: string
  /** Pages that only exist for the UFC (the prediction model is trained on UFC fights only). */
  hasPredictions: boolean
  /** Set for an organization that no longer holds events: what happened to it. Its pages read as an archive. */
  archived?: string
  /** False for an organization with no rankings page (its champions still show on its home page). */
  hasRankings: boolean
  /** Whether the organization has a dedicated Champions page (/champions, /pfl/champions, /one/champions, /bellator/champions). */
  hasChampions: boolean
}

export const ORGS: Record<OrgId, OrgConfig> = {
  ufc: {
    id: 'ufc',
    name: 'Ultimate Fighting Championship',
    shortName: 'UFC',
    basePath: '',
    sourceName: 'ufc.com',
    sourceUrl: 'https://www.ufc.com',
    tagline: 'Stats, rankings and AI win predictions.',
    hasPredictions: true,
    hasRankings: true,
    hasChampions: true,
  },
  pfl: {
    id: 'pfl',
    name: 'Professional Fighters League',
    shortName: 'PFL',
    basePath: '/pfl',
    sourceName: 'pflmma.com',
    sourceUrl: 'https://pflmma.com',
    tagline: 'Fighters, events and league rankings.',
    hasPredictions: false,
    hasRankings: true,
    hasChampions: true,
  },
  one: {
    id: 'one',
    name: 'ONE Championship',
    shortName: 'ONE',
    basePath: '/one',
    sourceName: 'onefc.com',
    sourceUrl: 'https://www.onefc.com/events/#past',
    tagline: 'MMA, Muay Thai, champions and AI win predictions.',
    hasPredictions: true,
    hasRankings: true,
    hasChampions: true,
  },
  bellator: {
    id: 'bellator',
    name: 'Bellator MMA',
    shortName: 'Bellator',
    basePath: '/bellator',
    sourceName: 'ESPN and Wikipedia',
    sourceUrl: 'https://www.espn.com/mma/',
    tagline: 'Archive 2009–2023: fighters, events and champions.',
    hasPredictions: false,
    archived: 'Archive 2009–2023. Bellator held its last event in 2023.',
    hasRankings: false,
    hasChampions: true,
  },
}

/** Display order of the organization switcher. Add a new organization here and in ORGS. */
export const ORG_LIST: OrgConfig[] = [ORGS.ufc, ORGS.pfl, ORGS.one, ORGS.bellator]

/** Organizations served by the generic /orgs/{id} API (everything but the UFC, which has its own endpoints). */
export const GENERIC_ORGS: OrgConfig[] = ORG_LIST.filter((org) => org.id !== 'ufc')

const SECTIONS: OrgSection[] = ['fighters', 'events', 'rankings', 'gyms', 'champions', 'predictor']

/** Which organization a URL belongs to: "/pfl/events" is the PFL, everything else is the UFC. */
export function orgFromPathname(pathname: string): OrgConfig {
  const first = pathname.split('/')[1] ?? ''
  return GENERIC_ORGS.find((org) => org.id === first) ?? ORGS.ufc
}

/** Route path for a section of an organization. UFC fighters are at "/fighters", PFL fighters at "/pfl/fighters". */
export function orgPath(org: OrgConfig | OrgId | string, section?: OrgSection): string {
  const config = typeof org === 'string' ? (ORGS[org as OrgId] ?? { basePath: `/${org}` }) : org
  if (!section) return config.basePath || '/home'
  return config.basePath ? `${config.basePath}/${section}` : `/${section}`
}

/** When the user clicks another organization in the switcher, keep them on the matching page if it has one. */
export function switchOrgPath(target: OrgConfig, currentPath: string): string {
  const currentOrg = orgFromPathname(currentPath)
  let tail = currentPath
  if (currentOrg.basePath && tail.startsWith(currentOrg.basePath)) {
    tail = tail.slice(currentOrg.basePath.length)
  }
  const clean = tail.replace(/^\/+/, '').split('/')[0] as OrgSection
  const validSection = SECTIONS.includes(clean) ? clean : undefined

  if (validSection === 'rankings' && !target.hasRankings) return orgPath(target)
  if (validSection === 'champions' && !target.hasChampions) return orgPath(target)
  if (validSection === 'predictor' && !target.hasPredictions) return orgPath(target)

  return orgPath(target, validSection)
}

/** The landing screen sits at "/", outside the organization hierarchy. */
export const LANDING_PATH = '/'

export function isLandingPath(pathname: string): boolean {
  return pathname === LANDING_PATH || pathname === ''
}
