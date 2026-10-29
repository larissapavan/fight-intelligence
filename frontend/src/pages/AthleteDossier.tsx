import { useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { EditorialFighterDossier } from '../shared/components/editorial/EditorialFighterDossier'

export function AthleteDossier() {
  const { name } = useParams<{ name?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const fighterName = useMemo(() => {
    if (name) return decodeURIComponent(name)
    const param = searchParams.get('name') || searchParams.get('a')
    if (param) return param
    return 'Alex Pereira'
  }, [name, searchParams])

  const opponentName = useMemo(() => {
    return searchParams.get('b') || searchParams.get('vs') || undefined
  }, [searchParams])

  const handleSelectFighter = (selectedName: string) => {
    navigate(`/athlete/${encodeURIComponent(selectedName)}`)
  }

  return (
    <EditorialFighterDossier
      initialFighterName={fighterName}
      initialOpponentName={opponentName}
      onSelectFighter={handleSelectFighter}
      onClose={() => navigate(-1)}
    />
  )
}
