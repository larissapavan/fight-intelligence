import type { FighterProfile, FightRecord } from '../../types/api'

export interface CareerPhase {
  id: string
  chapterNumber: string
  period: string
  title: Record<'en' | 'pt' | 'fr', string>
  story: Record<'en' | 'pt' | 'fr', string>
  wins: number
  losses: number
  finishes: number
  finishRate: number
  keyBouts: FightRecord[]
  highlightBadge?: string
}

export function buildCareerPhases(
  profile: FighterProfile,
  fights: FightRecord[],
): CareerPhase[] {
  // Sort fights chronologically (oldest to newest)
  const sorted = [...fights].sort((a, b) => {
    if (!a.date) return -1
    if (!b.date) return 1
    return new Date(a.date).getTime() - new Date(b.date).getTime()
  })

  const total = sorted.length

  if (total === 0) {
    const wins = profile.wins ?? 0
    const losses = profile.losses ?? 0
    return [
      {
        id: 'overview',
        chapterNumber: '01',
        period: `${profile.ufc_debut?.slice(0, 4) ?? '2020'} — PRESENT`,
        title: {
          en: 'Ascent to Combat Mastery',
          pt: 'Ascensão ao Domínio no Combate',
          fr: 'Ascension vers la Maîtrise du Combat',
        },
        story: {
          en: `${profile.name} established dominance inside the cage, competing across the highest echelons of the UFC ${profile.division ?? 'division'}.`,
          pt: `${profile.name} consolidou seu domínio dentro do octógono, competindo no mais alto escalão da categoria ${profile.division ?? ''} do UFC.`,
          fr: `${profile.name} a imposé sa domination dans l'octogone, évoluant au plus haut niveau de la division ${profile.division ?? ''} de l'UFC.`,
        },
        wins,
        losses,
        finishes: Math.round(wins * 0.7),
        finishRate: 70,
        keyBouts: [],
        highlightBadge: profile.belt ? 'CHAMPION' : 'TOP CONTENDER',
      },
    ]
  }

  // Segment fights into 3 or 4 chronological eras
  const numPhases = total >= 12 ? 4 : total >= 6 ? 3 : 2
  const chunkSize = Math.ceil(total / numPhases)
  const chunks: FightRecord[][] = []

  for (let i = 0; i < total; i += chunkSize) {
    chunks.push(sorted.slice(i, i + chunkSize))
  }

  const phaseMeta = [
    {
      title: {
        en: 'The Genesis & Octagon Arrival',
        pt: 'A Gênese & Chegada ao Octógono',
        fr: 'La Genèse & Entrée dans l’Octogone',
      },
      badge: 'DEBUT ERA',
      story: (name: string, div: string, count: number, wins: number, koSub: number) => ({
        en: `The initial trial by fire. Across ${count} grueling matchups, ${name} laid down their technical foundation, collecting ${wins} victories with ${koSub} devastating finishes that signaled a dangerous new presence in the ${div}.`,
        pt: `O teste de fogo inicial. Ao longo de ${count} combates intensos, ${name} estabeleceu sua base técnica e acumulou ${wins} vitórias com ${koSub} finalizações contundentes, avisando a divisão ${div} sobre uma nova força.`,
        fr: `L'épreuve du feu initiale. À travers ${count} combats acharnés, ${name} a forgé ses fondations martiales, signant ${wins} victoires dont ${koSub} finitions éclatantes dans la catégorie ${div}.`,
      }),
    },
    {
      title: {
        en: 'The Contender Crucible',
        pt: 'A Forja dos Desafiantes',
        fr: 'L’Épreuve des Prétendants',
      },
      badge: 'CONTENDER RUN',
      story: (name: string, _div: string, _count: number, wins: number, _koSub: number) => ({
        en: `Entering the ranked waters. Tested against seasoned veterans, ${name} demonstrated elite composure and tactical maturity, amassing ${wins} key triumphs on the road to title contention.`,
        pt: `A entrada nas águas profundas dos ranqueados. Testado contra veteranos condecorados, ${name} demonstrou frieza e maturidade tática, conquistando ${wins} triunfos cruciais rumo ao topo.`,
        fr: `L'entrée dans l'élite du classement. Opposé à des vétérans chevronnés, ${name} a fait preuve d'un sang-froid et d'une rigueur tactique remarquables, cumulant ${wins} victoires déterminantes vers le sommet.`,
      }),
    },
    {
      title: {
        en: 'Championship Peaks & Defining Wars',
        pt: 'O Ápice do Cinturão & Grandes Batalhas',
        fr: 'Sommets Mondiaux & Combats Mythiques',
      },
      badge: profile.belt ? 'CHAMPIONSHIP' : 'ELITE WARS',
      story: (name: string, _div: string, _count: number, _wins: number, _koSub: number) => ({
        en: `The clash of titans. At the highest level of combat athletics, ${name} went toe-to-toe with world champions and hall-of-fame caliber opponents, delivering career-defining moments.`,
        pt: `O embate entre titãs. No mais alto nível dos esportes de combate, ${name} enfrentou campeões mundiais e oponentes de calibre lendário, consolidando performances memoráveis.`,
        fr: `Le choc des titans. Au pinacle des sports de combat, ${name} a défié des champions d'exception, livrant des prestations mémorables qui ont marqué l'histoire de la catégorie.`,
      }),
    },
    {
      title: {
        en: 'Modern Reign & Legacy',
        pt: 'Reinado Moderno & Legado',
        fr: 'Règne Moderne & Héritage',
      },
      badge: profile.belt ? 'UNDISPUTED REIGN' : 'POUND-FOR-POUND',
      story: (_name: string, _div: string, _count: number, _wins: number, _koSub: number) => ({
        en: 'The era of mastery. Standing firm among the pound-for-pound elite, every walk to the Octagon is a testament to strategic longevity, supreme physical conditioning, and lethal execution.',
        pt: 'A era do domínio supremo. Firme entre a elite peso por peso mundial, cada caminhada ao cage é uma aula de longevidade tática, condicionamento e execução letal.',
        fr: "L'ère de la consécration. Bien ancré dans l'élite mondiale pound-for-pound, chaque entrée dans la cage témoigne d'une longévité stratégique et d'une précision chirurgicale.",
      }),
    },
  ]

  return chunks.map((chunk, idx) => {
    const metaIdx = Math.min(idx, phaseMeta.length - 1)
    const meta = phaseMeta[metaIdx]
    const wins = chunk.filter((f) => f.result === 'win').length
    const losses = chunk.filter((f) => f.result === 'loss').length
    const finishes = chunk.filter((f) => {
      const m = (f.method || '').toLowerCase()
      return f.result === 'win' && (m.includes('ko') || m.includes('tko') || m.includes('sub'))
    }).length
    const finishRate = wins > 0 ? Math.round((finishes / wins) * 100) : 0

    const startDate = chunk[0]?.date?.slice(0, 4) || '—'
    const endDate = chunk[chunk.length - 1]?.date?.slice(0, 4) || 'PRESENT'
    const period = startDate === endDate ? startDate : `${startDate} — ${endDate}`

    return {
      id: `phase-${idx + 1}`,
      chapterNumber: `0${idx + 1}`,
      period,
      title: meta.title,
      story: meta.story(
        profile.name,
        profile.division || 'UFC',
        chunk.length,
        wins,
        finishes,
      ),
      wins,
      losses,
      finishes,
      finishRate,
      keyBouts: chunk.slice(-3).reverse(),
      highlightBadge: idx === chunks.length - 1 && profile.belt ? 'UNDISPUTED CHAMPION' : meta.badge,
    }
  })
}
