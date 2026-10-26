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

export function localizeFeature(name: string, isPt = false): string {
  if (!isPt) return name
  return FEATURE_NAMES_PT[name] ?? name
}
