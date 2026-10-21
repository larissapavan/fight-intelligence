export type OrgId = 'ufc' | 'pfl' | 'bellator'

export type OrgSection = 'fighters' | 'events' | 'rankings' | 'gyms'

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
  /** Replaces the default description of the rankings page. */
  rankingsNote?: string
}

export const ORGS: Record<OrgId, OrgConfig> = {
  ufc: {
    id: 'ufc',
    name: 'Ultimate Fighting Championship',
    shortName: 'UFC',
    basePath: '',
    sourceName: 'ufc.com',
    sourceUrl: 'https://www.ufc.com',
    tagline: 'Fight stats, rankings and win predictions, with an explanation for every pick.',
    hasPredictions: true,
  },
  pfl: {
    id: 'pfl',
    name: 'Professional Fighters League',
    shortName: 'PFL',
    basePath: '/pfl',
    sourceName: 'pflmma.com',
    sourceUrl: 'https://pflmma.com',
    tagline: 'PFL fighters, every event result and the official rankings.',
    hasPredictions: false,
  },
  bellator: {
    id: 'bellator',
    name: 'Bellator MMA',
    shortName: 'Bellator',
    basePath: '/bellator',
    sourceName: 'ESPN and Wikipedia',
    sourceUrl: 'https://www.espn.com/mma/',
    tagline: 'The Bellator archive: every event from 2009 to 2023, its fighters and the champions it ended with.',
    hasPredictions: false,
    archived: 'Bellator held its last event in 2023 and was absorbed by the PFL, so this is an archive: nothing here is updated any more.',
    rankingsNote: 'Bellator kept no rankings. These are the champions it ended with, division by division.',
  },
}

/** Display order of the organization switcher. Add a new organization here and in ORGS. */
export const ORG_LIST: OrgConfig[] = [ORGS.ufc, ORGS.pfl, ORGS.bellator]

/** Organizations served by the generic /orgs/{id} API (everything but the UFC, which has its own endpoints). */
export const GENERIC_ORGS: OrgConfig[] = ORG_LIST.filter((org) => org.id !== 'ufc')

const SECTIONS: OrgSection[] = ['fighters', 'events', 'rankings', 'gyms']

/** Which organization a URL belongs to: "/pfl/events" is the PFL, everything else is the UFC. */
export function orgFromPathname(pathname: string): OrgConfig {
  const first = pathname.split('/')[1] ?? ''
  return GENERIC_ORGS.find((org) => org.id === first) ?? ORGS.ufc
}

/** A page of an organization: orgPath(ORGS.pfl, 'events') is "/pfl/events", orgPath(ORGS.ufc) is "/". */
export function orgPath(org: OrgConfig | OrgId, section: OrgSection | '' = ''): string {
  const config = typeof org === 'string' ? ORGS[org] : org
  const tail = section ? `/${section}` : ''
  return `${config.basePath}${tail}` || '/'
}

/** The section of the page being viewed, if it exists in every organization ("/pfl/events" and "/events" are both "events"). */
export function sectionOfPathname(pathname: string): OrgSection | '' {
  const parts = pathname.split('/').filter(Boolean)
  const last = parts[GENERIC_ORGS.some((org) => org.id === parts[0]) ? 1 : 0]
  return SECTIONS.find((section) => section === last) ?? ''
}

/** Where the switcher sends the reader: the same section in the other organization, or its home page. */
export function switchOrgPath(target: OrgConfig, pathname: string): string {
  return orgPath(target, sectionOfPathname(pathname))
}
