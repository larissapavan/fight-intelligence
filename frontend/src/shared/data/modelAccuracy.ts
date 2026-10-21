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
export function shownMetrics(info: ModelInfo | null | undefined): ShownMetrics {
  const recent = info?.recent_evaluation
  if (recent) {
    return {
      accuracy: recent.accuracy,
      rocAuc: recent.roc_auc,
      logLoss: recent.log_loss,
      source: 'recent',
      caption: `${recent.fights.toLocaleString('en-US')} recent fights`,
    }
  }
  if (info?.metrics?.accuracy != null) {
    return {
      accuracy: info.metrics.accuracy,
      rocAuc: info.metrics.roc_auc ?? null,
      logLoss: info.metrics.log_loss ?? null,
      source: 'reported',
      caption: 'reported, not checked',
    }
  }
  return { accuracy: null, rocAuc: null, logLoss: null, source: 'none', caption: '' }
}
