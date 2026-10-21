import { useLocation } from 'react-router-dom'

import { orgFromPathname, type OrgConfig } from '../data/orgs'

/** The organization of the page being viewed, read from the URL ("/pfl/..." is the PFL, anything else the UFC). */
export function useOrg(): OrgConfig {
  const { pathname } = useLocation()
  return orgFromPathname(pathname)
}
