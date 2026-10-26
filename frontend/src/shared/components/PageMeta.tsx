import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const SITE = 'Fight Intelligence'
const DEFAULT_DESCRIPTION =
  'Fight stats, rankings and results for the UFC, the PFL and the Bellator archive, plus UFC win predictions with the reasons behind each one.'
const DEFAULT_DESCRIPTION_PT =
  'Estatísticas, rankings e resultados para o UFC, a PFL e o acervo histórico do Bellator, com previsões de vitória e inteligência analítica.'

const GYM_PAGE = /^(\/pfl|\/bellator)?\/gyms\/[^/]+$/
const GYM_DETAIL = { title: 'Gym', description: 'Who trains at this gym: its fighters, champions and records.' }
const GYM_DETAIL_PT = { title: 'Academia', description: 'Quem treina nesta academia: atletas, campeões e estatísticas.' }

const PAGES: Record<string, { title: string; description: string }> = {
  '/home': { title: 'UFC', description: 'The next UFC card with the model\'s picks, who is on a streak and the latest headlines.' },
  '/predictor': { title: 'Predict a fight', description: 'Pick two UFC fighters and get a win probability with the stats that drove it.' },
  '/head-to-head': { title: 'Head-to-head history', description: 'Every time two UFC fighters have met, who won and how, plus their common opponents.' },
  '/matchup-intelligence': { title: 'Matchup analysis', description: 'Striking, grappling and physical numbers for any two UFC fighters, and the factors the model weighed most.' },
  '/fighters': { title: 'Fighters', description: 'UFC fighter profiles by weight class: records, career timelines, origins and similar fighters.' },
  '/events': { title: 'Events', description: 'The full UFC event archive with results, plus upcoming cards and the model\'s picks.' },
  '/rankings': { title: 'Rankings', description: 'The official UFC divisional and pound-for-pound rankings with fighter photos.' },
  '/champions': { title: 'Champions', description: 'Current UFC champions, the greatest reigns and title-fight records, including multi-division champions.' },
  '/record-book': { title: 'Record book', description: 'The UFC\'s all-time career leaders in 32 stats: fights, time, striking and grappling.' },
  '/about': { title: 'About', description: 'Who makes this, where the data comes from and what its limits are.' },
  '/data': { title: 'Data', description: 'How raw UFC data becomes the dataset the model predicts from.' },
  '/model': { title: 'System', description: 'The prediction model, how it was trained and how it compares with simpler ones.' },
  '/track-record': { title: 'Track record', description: 'How the model\'s picks hold up against real fights: saved before the event, checked after.' },
  '/pfl': { title: 'PFL', description: 'Professional Fighters League: the next card, the champions and the latest results.' },
  '/pfl/fighters': { title: 'PFL fighters', description: 'PFL fighter profiles: records, builds, camps and every fight.' },
  '/pfl/events': { title: 'PFL events', description: 'The full PFL event archive with results, plus upcoming cards.' },
  '/gyms': { title: 'Gyms', description: 'Where UFC fighters train: every gym and team with its fighters, champions and records.' },
  '/pfl/gyms': { title: 'PFL gyms', description: 'Where PFL fighters train: every gym and team with its fighters and records.' },
  '/bellator': { title: 'Bellator', description: 'The Bellator archive: every event from 2009 to 2023, its fighters and the champions it ended with.' },
  '/bellator/fighters': { title: 'Bellator fighters', description: 'Bellator fighter profiles: records, builds, camps and every fight.' },
  '/bellator/events': { title: 'Bellator events', description: 'Every Bellator event from 2009 to 2023 with results.' },
  '/bellator/gyms': { title: 'Bellator gyms', description: 'Where Bellator fighters train: every gym and team with its fighters.' },
  '/pfl/rankings': { title: 'PFL rankings', description: 'The official PFL divisional and pound-for-pound rankings.' },
  '/about-model': { title: 'About the model', description: 'A full-stack applied AI project: data pipeline, model and API.' },
}

const PAGES_PT: Record<string, { title: string; description: string }> = {
  '/home': { title: 'UFC', description: 'Próximos eventos do UFC com previsões da IA, momentos dos atletas e notícias.' },
  '/predictor': { title: 'Simulador de Lutas', description: 'Escolha dois lutadores do UFC e receba a probabilidade de vitória e fatores decisivos.' },
  '/head-to-head': { title: 'Confronto Direto', description: 'Histórico de combates entre atletas do UFC, métodos de vitória e oponentes em comum.' },
  '/matchup-intelligence': { title: 'Análise de Confronto', description: 'Números detalhados de trocação, chão e dados físicos com explicabilidade da IA.' },
  '/fighters': { title: 'Lutadores', description: 'Perfis completos de atletas do UFC por categoria: cartel, histórico e lutadores similares.' },
  '/events': { title: 'Eventos', description: 'Arquivo histórico de eventos do UFC com resultados oficiais e próximos cards.' },
  '/rankings': { title: 'Rankings', description: 'Rankings oficiais do UFC por categoria e peso por peso com fotos dos atletas.' },
  '/champions': { title: 'Campeões', description: 'Campeões atuais do UFC, maiores reinados da história e recordistas de cinturão.' },
  '/record-book': { title: 'Livro dos Recordes', description: 'Líderes históricos de todas as 32 estatísticas oficiais do UFC: lutas, tempo, trocação e grappling.' },
  '/about': { title: 'Sobre o Projeto', description: 'Projeto pessoal independente de Larissa Pavan, fontes de dados e metodologia.' },
  '/data': { title: 'Dados', description: 'Como os dados brutos de lutas são tratados para alimentar o modelo preditivo.' },
  '/model': { title: 'Sistema e IA', description: 'O modelo preditivo de machine learning, métricas de precisão e calibração.' },
  '/track-record': { title: 'Histórico de Palpites', description: 'Desempenho dos palpites da IA em lutas reais: registrados antes do card e checados após o evento.' },
  '/pfl': { title: 'PFL', description: 'Professional Fighters League: próximos eventos, campeões e resultados.' },
  '/pfl/fighters': { title: 'Lutadores da PFL', description: 'Perfis de atletas da PFL: cartel, medidas, equipes e histórico.' },
  '/pfl/events': { title: 'Eventos da PFL', description: 'Histórico de eventos da PFL com todos os resultados e próximos cards.' },
  '/gyms': { title: 'Academias', description: 'Onde os atletas treinam: equipes, academias, lutadores e campeões.' },
  '/pfl/gyms': { title: 'Academias da PFL', description: 'Onde os atletas da PFL treinam: equipes e lutadores.' },
  '/bellator': { title: 'Bellator', description: 'Acervo histórico do Bellator: todos os eventos de 2009 a 2023, atletas e últimos campeões.' },
  '/bellator/fighters': { title: 'Lutadores do Bellator', description: 'Atletas do Bellator: cartel, medidas, equipes e combates.' },
  '/bellator/events': { title: 'Eventos do Bellator', description: 'Todos os eventos do Bellator de 2009 a 2023 com resultados.' },
  '/bellator/gyms': { title: 'Academias do Bellator', description: 'Academias e equipes dos atletas do Bellator.' },
  '/pfl/rankings': { title: 'Rankings da PFL', description: 'Rankings oficiais da PFL por categoria e peso por peso.' },
  '/about-model': { title: 'Sobre o Modelo de IA', description: 'Projeto full-stack de IA aplicada: pipeline de dados, modelo preditivo e API.' },
}

function setMeta(selector: string, value: string) {
  document.querySelector(selector)?.setAttribute('content', value)
}

/** Keeps the tab title and the description/share tags in step with the page being viewed (the app is a single page). */
export function PageMeta() {
  const { pathname } = useLocation()
  const { i18n } = useTranslation()
  const isPt = Boolean(i18n.language?.startsWith('pt'))

  useEffect(() => {
    const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname
    const pageMap = isPt ? PAGES_PT : PAGES
    const gymFallback = isPt ? GYM_DETAIL_PT : GYM_DETAIL
    const page = pageMap[path] ?? (GYM_PAGE.test(path) ? gymFallback : undefined)
    const title = page ? `${page.title} · ${SITE}` : path === '/' ? SITE : `${isPt ? 'Página não encontrada' : 'Page not found'} · ${SITE}`
    const description = page?.description ?? (isPt ? DEFAULT_DESCRIPTION_PT : DEFAULT_DESCRIPTION)

    document.title = title
    setMeta('meta[name="description"]', description)
    setMeta('meta[property="og:title"]', title)
    setMeta('meta[property="og:description"]', description)
    setMeta('meta[name="twitter:title"]', title)
    setMeta('meta[name="twitter:description"]', description)
  }, [pathname, isPt])

  return null
}
