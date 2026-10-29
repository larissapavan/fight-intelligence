/** Win-method buckets used by the performance charts, as shown to the user. */
export const METHOD_LABELS_EN: Record<string, string> = {
  'KO/TKO': 'KO/TKO',
  Submission: 'Submission',
  Decision: 'Decision',
  'U-DEC': 'Unanimous Decision',
  'S-DEC': 'Split Decision',
  'M-DEC': 'Majority Decision',
  Disqualification: 'Disqualification',
  DQ: 'Disqualification',
  Overturned: 'No Contest (NC)',
  Other: 'Other',
}

export const METHOD_LABELS_PT: Record<string, string> = {
  'KO/TKO': 'Nocaute (KO/TKO)',
  Submission: 'Finalização',
  Decision: 'Decisão',
  'U-DEC': 'Decisão Unânime',
  'S-DEC': 'Decisão Dividida',
  'M-DEC': 'Decisão Majoritária',
  Disqualification: 'Desqualificação (DQ)',
  DQ: 'Desqualificação (DQ)',
  Overturned: 'Sem Resultado (NC)',
  Other: 'Outro',
}

export const METHOD_LABELS = METHOD_LABELS_EN

const METHOD_LABELS_FR: Record<string, string> = {
  'KO/TKO': 'KO/TKO',
  Submission: 'Soumission',
  Decision: 'Décision',
  'U-DEC': 'Décision unanime',
  'S-DEC': 'Décision partagée',
  'M-DEC': 'Décision majoritaire',
  Disqualification: 'Disqualification',
  DQ: 'Disqualification',
  Overturned: 'Sans résultat (NC)',
  Other: 'Autre',
}

const TECHNIQUES_PT: Record<string, string> = {
  'rear-naked choke': 'mata-leão',
  'rear naked choke': 'mata-leão',
  'guillotine choke': 'guilhotina',
  guillotine: 'guilhotina',
  armbar: 'chave de braço',
  'arm-bar': 'chave de braço',
  'triangle choke': 'triângulo',
  triangle: 'triângulo',
  'arm-triangle choke': 'katagatame',
  'arm-triangle': 'katagatame',
  'arm triangle': 'katagatame',
  kimura: 'kimura',
  americana: 'americana',
  kneebar: 'chave de joelho',
  'heel hook': 'chave de calcanhar',
  'ankle lock': 'chave de tornozelo',
  'calf slicer': 'chave de panturrilha',
  'neck crank': 'trava de pescoço',
  twister: 'twister',
  omoplata: 'omoplata',
  "d'arce choke": "d'arce",
  'darce choke': "d'arce",
  "von flue choke": 'von flue',
  'anaconda choke': 'anaconda',
  'peruvian necktie': 'gravata peruana',
  'inverted triangle': 'triângulo invertido',
  punches: 'socos',
  punch: 'soco',
  elbows: 'cotoveladas',
  elbow: 'cotovelada',
  knees: 'joelhadas',
  knee: 'joelhada',
  'flying knee': 'joelhada voadora',
  'head kick': 'chute na cabeça',
  'body kick': 'chute no corpo',
  'leg kick': 'chute na perna',
  'leg kicks': 'chutes na perna',
  'spinning back fist': 'soco rodado',
  'spinning back kick': 'chute rodado',
  'spinning wheel kick': 'chute em gancho rodado',
  slam: 'bate-estaca',
  'ground and pound': 'ground and pound',
  'doctor stoppage': 'interrupção médica',
  "doctor's stoppage": 'interrupção médica',
  'corner stoppage': 'desistência do córner',
  retirement: 'desistência',
  injury: 'lesão',
}

const TECHNIQUES_FR: Record<string, string> = {
  'rear-naked choke': 'étranglement arrière',
  'rear naked choke': 'étranglement arrière',
  'guillotine choke': 'guillotine',
  guillotine: 'guillotine',
  armbar: 'clé de bras',
  'triangle choke': 'étranglement triangle',
  triangle: 'triangle',
  'arm-triangle choke': 'étranglement bras-tête',
  kimura: 'kimura',
  americana: 'americana',
  kneebar: 'clé de genou',
  'heel hook': 'clé de talon',
  'ankle lock': 'clé de cheville',
  punches: 'coups de poing',
  punch: 'coup de poing',
  elbows: 'coups de coude',
  knees: 'coups de genou',
  'flying knee': 'coup de genou sauté',
  'head kick': 'coup de pied à la tête',
  'spinning back kick': 'coup de pied retourné',
  'doctor stoppage': 'arrêt du médecin',
  "doctor's stoppage": 'arrêt du médecin',
  'corner stoppage': 'abandon du coin',
  injury: 'blessure',
}

/** Translates detailed fight outcome methods like 'Submission (rear-naked choke)' or 'TKO (punches)' */
export function translateFightMethod(
  method: string | null | undefined,
  language: string | boolean = false,
): string {
  if (!method) return ''
  const trimmed = method.trim()
  const lang = typeof language === 'string' ? language : language ? 'pt' : 'en'
  const isPt = lang.startsWith('pt') || lang === 'pt'
  const isFr = lang.startsWith('fr')

  if (!isPt && !isFr) return trimmed

  // Check known direct labels
  const directMap = isPt ? METHOD_LABELS_PT : METHOD_LABELS_FR
  if (directMap[trimmed]) return directMap[trimmed]

  // Handle Decision formats: "Decision - Unanimous", "Unanimous Decision", etc.
  const lower = trimmed.toLowerCase()
  if (lower.includes('unanimous')) {
    return isPt ? 'Decisão Unânime' : 'Décision unanime'
  }
  if (lower.includes('split')) {
    return isPt ? 'Decisão Dividida' : 'Décision partagée'
  }
  if (lower.includes('majority')) {
    return isPt ? 'Decisão Majoritária' : 'Décision majoritaire'
  }
  if (lower === 'overturned' || lower === 'no contest' || lower === 'nc') {
    return isPt ? 'Sem Resultado (NC)' : 'Sans résultat (NC)'
  }
  if (lower.includes('disqualification') || lower === 'dq') {
    return isPt ? 'Desqualificação (DQ)' : 'Disqualification (DQ)'
  }

  // Handle "Method (Detail)" pattern, e.g. "Submission (rear-naked choke)", "TKO (punches)", "KO (head kick)"
  const parenMatch = trimmed.match(/^([^(]+)\s*\(([^)]+)\)$/)
  if (parenMatch) {
    const rawBase = parenMatch[1].trim()
    const rawDetail = parenMatch[2].trim().toLowerCase()
    const techMap = isPt ? TECHNIQUES_PT : TECHNIQUES_FR
    const detailTranslated = techMap[rawDetail] ?? rawDetail

    let baseTranslated = rawBase
    const lowerBase = rawBase.toLowerCase()
    if (lowerBase.includes('submission')) {
      baseTranslated = isPt ? 'Finalização' : 'Soumission'
    } else if (lowerBase.includes('tko')) {
      baseTranslated = 'TKO'
    } else if (lowerBase.includes('ko')) {
      baseTranslated = 'KO'
    }

    return `${baseTranslated} (${detailTranslated})`
  }

  if (lower.includes('submission')) {
    return isPt ? 'Finalização' : 'Soumission'
  }
  if (lower.includes('decision')) {
    return isPt ? 'Decisão' : 'Décision'
  }

  return trimmed
}

/** Translates fighter stances (e.g. Orthodox -> Destro) */
export function translateStance(
  stance: string | null | undefined,
  language: string | boolean = false,
): string {
  if (!stance) return ''
  const trimmed = stance.trim()
  const lower = trimmed.toLowerCase()
  const lang = typeof language === 'string' ? language : language ? 'pt' : 'en'
  const isPt = lang.startsWith('pt') || lang === 'pt'
  const isFr = lang.startsWith('fr')

  if (isPt) {
    if (lower === 'orthodox') return 'Destro'
    if (lower === 'southpaw') return 'Canhoto'
    if (lower === 'switch') return 'Ambidestro'
    if (lower === 'open stance') return 'Postura Aberta'
    if (lower === 'sidestance') return 'Postura Lateral'
    return trimmed
  }

  if (isFr) {
    if (lower === 'orthodox') return 'Droitier'
    if (lower === 'southpaw') return 'Gaucher'
    if (lower === 'switch') return 'Ambidextre'
    return trimmed
  }

  return trimmed
}

const COUNTRY_MAP_PT: Record<string, string> = {
  brazil: 'Brasil',
  'united states': 'Estados Unidos',
  usa: 'Estados Unidos',
  russia: 'Rússia',
  england: 'Inglaterra',
  mexico: 'México',
  canada: 'Canadá',
  france: 'França',
  australia: 'Austrália',
  japan: 'Japão',
  'south korea': 'Coreia do Sul',
  china: 'China',
  poland: 'Polônia',
  ireland: 'Irlanda',
  sweden: 'Suécia',
  'new zealand': 'Nova Zelândia',
  netherlands: 'Holanda',
  germany: 'Alemanha',
  italy: 'Itália',
  spain: 'Espanha',
  argentina: 'Argentina',
  nigeria: 'Nigéria',
  cameroon: 'Camarões',
  'south africa': 'África do Sul',
  georgia: 'Geórgia',
  armenia: 'Armênia',
  kazakhstan: 'Cazaquistão',
  kyrgyzstan: 'Quirguistão',
  uzbekistan: 'Uzbequistão',
  'czech republic': 'República Tcheca',
  czechia: 'República Tcheca',
  austria: 'Áustria',
  switzerland: 'Suíça',
  belgium: 'Bélgica',
  norway: 'Noruega',
  finland: 'Finlândia',
  denmark: 'Dinamarca',
  jamaica: 'Jamaica',
  ecuador: 'Equador',
  chile: 'Chile',
  colombia: 'Colômbia',
  peru: 'Peru',
}

/** Formats and translates fighter hometown (e.g. 'State of São Paulo, Brazil' -> 'São Paulo, Brasil') */
export function translateHometown(
  hometown: string | null | undefined,
  language: string | boolean = false,
): string {
  if (!hometown) return ''
  let cleaned = hometown.trim().replace(/^State of\s+/i, '')
  const lang = typeof language === 'string' ? language : language ? 'pt' : 'en'

  if (lang.startsWith('pt') || lang === 'pt') {
    for (const [en, pt] of Object.entries(COUNTRY_MAP_PT)) {
      const reg = new RegExp(`\\b${en}\\b`, 'gi')
      cleaned = cleaned.replace(reg, pt)
    }
  }

  return cleaned
}

export function getMethodLabel(method: string | null | undefined, language: string | boolean = false): string {
  const french = typeof language === 'string' && language.startsWith('fr')
  const portuguese = language === true || (typeof language === 'string' && language.startsWith('pt'))
  if (!method) return portuguese ? 'A definir' : french ? 'À définir' : 'Pending'
  const map = portuguese ? METHOD_LABELS_PT : french ? METHOD_LABELS_FR : METHOD_LABELS_EN
  return map[method] ?? translateFightMethod(method, language)
}

export function formatPercent(value: number | null | undefined) {
  if (value == null) return '—'
  return `${(value * 100).toFixed(1)}%`
}
