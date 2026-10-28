import { L, localeTag } from '../../i18n/lang'
import type { ModelInfo } from '../types/api'

export type ShownMetrics = {
  accuracy: number | null
  rocAuc: number | null
  logLoss: number | null
  /** "recent": measured again on recent fights. "reported": only what the model's own file says. */
  source: 'recent' | 'reported' | 'none'
  /** Short caption for a number: where it comes from. */
  caption: string
}

/**
 * The model's numbers to put on screen. The accuracy in the model's own file could not be reproduced, so the site shows
 * the one measured again on recent fights whenever the API sends it, and the reported one only as a fallback.
 */
export function shownMetrics(info: ModelInfo | null | undefined, language: string | boolean = 'en-US'): ShownMetrics {
  const recent = info?.recent_evaluation
  if (recent) {
    const count = recent.fights.toLocaleString(localeTag(language))
    return {
      accuracy: recent.accuracy,
      rocAuc: recent.roc_auc,
      logLoss: recent.log_loss,
      source: 'recent',
      caption: L(language, `${count} lutas recentes`, `${count} recent fights`, `${count} combats récents`),
    }
  }
  if (info?.metrics?.accuracy != null) {
    return {
      accuracy: info.metrics.accuracy,
      rocAuc: info.metrics.roc_auc ?? null,
      logLoss: info.metrics.log_loss ?? null,
      source: 'reported',
      caption: L(language, 'reportado, não verificado', 'reported, not checked', 'annoncé, non vérifié'),
    }
  }
  return { accuracy: null, rocAuc: null, logLoss: null, source: 'none', caption: '' }
}
