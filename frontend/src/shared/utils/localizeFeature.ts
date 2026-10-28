const FEATURE_NAMES_PT: Record<string, string> = {
  'Age difference': 'Diferença de idade',
  'Height difference': 'Diferença de altura',
  'Reach difference': 'Diferença de envergadura',
  'Wins difference': 'Diferença de vitórias',
  'Losses difference': 'Diferença de derrotas',
  'Striking accuracy gap': 'Diferença na precisão de golpes',
  'Takedown accuracy gap': 'Diferença no aproveitamento de quedas',
  'Win rate difference': 'Diferença na taxa de vitória',
  'Same stance': 'Mesma base / postura',
  'Fight month': 'Mês do combate',
  'Fight year': 'Ano do combate',
  'Fighter A win rate': 'Taxa de vitória (Lutador A)',
  'Fighter B win rate': 'Taxa de vitória (Lutador B)',
  'Fighter A striking accuracy': 'Precisão de golpes (Lutador A)',
  'Fighter B striking accuracy': 'Precisão de golpes (Lutador B)',
  'Fighter A takedown accuracy': 'Aproveitamento de quedas (Lutador A)',
  'Fighter B takedown accuracy': 'Aproveitamento de quedas (Lutador B)',
}

const FEATURE_NAMES_FR: Record<string, string> = {
  'Age difference': "Écart d'âge",
  'Height difference': 'Écart de taille',
  'Reach difference': "Écart d'allonge",
  'Wins difference': 'Écart de victoires',
  'Losses difference': 'Écart de défaites',
  'Striking accuracy gap': 'Écart de précision en striking',
  'Takedown accuracy gap': "Écart de précision aux amenées",
  'Win rate difference': 'Écart de taux de victoire',
  'Same stance': 'Même garde',
  'Fight month': 'Mois du combat',
  'Fight year': 'Année du combat',
  'Fighter A win rate': 'Taux de victoire (lutteur A)',
  'Fighter B win rate': 'Taux de victoire (lutteur B)',
  'Fighter A striking accuracy': 'Précision en striking (lutteur A)',
  'Fighter B striking accuracy': 'Précision en striking (lutteur B)',
  'Fighter A takedown accuracy': 'Précision aux amenées (lutteur A)',
  'Fighter B takedown accuracy': 'Précision aux amenées (lutteur B)',
}

export function localizeFeature(name: string, language: string | boolean = false): string {
  const portuguese = language === true || (typeof language === 'string' && language.startsWith('pt'))
  const french = typeof language === 'string' && language.startsWith('fr')
  if (portuguese) return FEATURE_NAMES_PT[name] ?? name
  if (french) return FEATURE_NAMES_FR[name] ?? name
  return name
}
