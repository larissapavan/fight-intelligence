/**
 * How the model's probabilities are put on screen.
 *
 * The model is overconfident: on recent fights the picks it rated 90% or more were right about 71% of the time. So a
 * probability past 90% is shown as "90%+" (and its mirror as "<10%") instead of a number that looks exact.
 */
const CAP = 0.9
const EPSILON = 1e-9 // 1 - 0.9 is 0.09999999999999998 in floating point

/** "63%", or "90%+" / "<10%" at the extremes. */
export function formatProbability(value: number): string {
  if (value >= CAP - EPSILON) return '90%+'
  if (value <= 1 - CAP + EPSILON) return '<10%'
  return `${Math.round(value * 100)}%`
}

/** How big the favorite's edge is, in words. `favorite` is the favorite's probability (0.5 to 1). */
export function edgeLabel(favorite: number, language: string | boolean = false): string {
  const portuguese = language === true || (typeof language === 'string' && language.startsWith('pt'))
  const french = typeof language === 'string' && language.startsWith('fr')
  if (favorite < 0.55) return portuguese ? 'Luta parelha' : french ? 'Combat équilibré' : 'Toss-up'
  if (favorite < 0.65) return portuguese ? 'Leve vantagem' : french ? 'Léger avantage' : 'Slight edge'
  if (favorite < 0.8) return portuguese ? 'Vantagem clara' : french ? 'Avantage net' : 'Clear edge'
  return portuguese ? 'Amplo favoritismo' : french ? 'Large favori' : 'Strong edge'
}

/** Localizes the backend prediction message ("The model gives X a [confidence] edge in this matchup."). */
export function localizePredictionMessage(message: string | null | undefined, winner: string, language: string | boolean = false): string {
  if (!message) return ''
  const portuguese = language === true || (typeof language === 'string' && language.startsWith('pt'))
  const french = typeof language === 'string' && language.startsWith('fr')
  if (french) {
    if (message.includes('a strong edge')) return `Le modèle donne un large avantage à ${winner} pour ce combat.`
    if (message.includes('a moderate edge')) return `Le modèle donne un avantage modéré à ${winner} pour ce combat.`
    if (message.includes('a competitive edge')) return `Le modèle donne un léger avantage à ${winner} dans un combat serré.`
    if (message.includes('The model gives')) {
      return message.replace(/The model gives (.+?) a (\w+) edge in this matchup\./, (_match, name, conf) => {
        const edge = conf === 'strong' ? 'un large avantage' : conf === 'moderate' ? 'un avantage modéré' : 'un léger avantage'
        return `Le modèle donne ${edge} à ${name} pour ce combat.`
      })
    }
    return message
  }
  if (!portuguese) return message
  if (message.includes('a strong edge')) {
    return `O modelo aponta amplo favoritismo para ${winner} neste confronto.`
  }
  if (message.includes('a moderate edge')) {
    return `O modelo aponta vantagem moderada para ${winner} neste confronto.`
  }
  if (message.includes('a competitive edge')) {
    return `O modelo aponta leve vantagem para ${winner} em um combate equilibrado.`
  }
  if (message.includes('The model gives')) {
    return message.replace(/The model gives (.+?) a (\w+) edge in this matchup\./, (_match, name, conf) => {
      const edge = conf === 'strong' ? 'amplo favoritismo' : conf === 'moderate' ? 'vantagem moderada' : 'leve vantagem'
      return `O modelo aponta ${edge} para ${name} neste confronto.`
    })
  }
  return message
}
