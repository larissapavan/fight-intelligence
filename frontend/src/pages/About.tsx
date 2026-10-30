import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Database, ExternalLink, Mail, Users } from 'lucide-react'

import { L } from '../i18n/lang'
import { YouTubeIcon, InstagramIcon, TikTokIcon } from '../shared/components/SocialLinks'

const GITHUB_PROFILE = 'https://github.com/larissapavan'
const LINKEDIN_PROFILE = 'https://www.linkedin.com/in/larissacpavan/'

const sources: { name: string; href?: string; use: string; usePt: string }[] = [
  {
    name: 'UFCStats.com',
    href: 'http://ufcstats.com',
    use: 'Fighter profiles, events, fight results and career stats.',
    usePt: 'Perfis de lutadores, histórico de eventos, resultados oficiais e estatísticas de carreira.',
  },
  {
    name: 'ESPN',
    href: 'https://www.espn.com/mma/',
    use: 'Events, results, upcoming cards, fighter records, new-fighter profiles, fighter photos and the news headlines on the home and events pages (each links back to the original story). Also the whole Bellator archive: its events, results, fighter profiles and headshots.',
    usePt: 'Eventos, resultados, cards futuros, fotos e notícias esportivas conectadas às matérias originais.',
  },
  {
    name: 'UFC.com',
    href: 'https://www.ufc.com/rankings',
    use: 'Official rankings, the current champions’ photos and hometowns.',
    usePt: 'Rankings oficiais atualizados, fotos dos campeões em atividade e cidades natais.',
  },
  {
    name: 'UFC Stats Leaders',
    href: 'https://statleaders.ufc.com/en/career',
    use: 'The UFC’s official career Record Book: all-time leaders in wins, finishes, striking, grappling and more.',
    usePt: 'Livro oficial de recordes do UFC: líderes históricos em vitórias, nocautes, finalizações, golpes e quedas.',
  },
  {
    name: 'roster.watch',
    href: 'https://www.roster.watch/',
    use: 'The UFC roster, current and former: who is on it, nationalities, debut and last fight dates, and the origin and honor badges (Contender Series, TUF, Road to UFC, BMF, Hall of Fame).',
    usePt: 'Status do plantel do UFC (lutadores ativos e ex-lutadores), nacionalidades, datas de estreia e honrarias (Contender Series, TUF, Hall da Fama).',
  },
  {
    name: 'pflmma.com',
    href: 'https://pflmma.com',
    use: 'The Professional Fighters League’s own site: its events, results, fighter profiles, headshots and the official rankings. Only the pages its robots.txt allows are read; the headshots are stored here as small copies.',
    usePt: 'Dados e rankings da Professional Fighters League (PFL).',
  },
  {
    name: 'FightHub',
    href: 'https://fighthub-app.com/br/gyms/',
    use: 'The directory of gyms and teams and the fighters who train in each, shown on the Gyms pages and matched by name with the fighters of each organization. Only the pages its robots.txt allows are read.',
    usePt: 'Diretório de academias, centros de treinamento e vinculação de lutadores e equipes.',
  },
  {
    name: 'Next-Fight',
    href: 'https://next-fight.com',
    use: 'Fight announcements, upcoming fight cards, matchup confirmations and title fight notices (such as UFC 336: Prates vs. Morales).',
    usePt: 'Anúncios antecipados de lutas, confirmação de cards futuros e disputas de cinturão (como o UFC 336: Prates vs. Morales).',
  },
  {
    name: 'Tapology',
    href: 'https://www.tapology.com',
    use: 'Fighter career records, comprehensive fight histories across regional and global MMA circuits (Jungle Fight, Predador FC, LFA, etc.), and finish methods.',
    usePt: 'Cartéis completos de lutadores, histórico de lutas em circuitos regionais e internacionais de MMA (Jungle Fight, Predador FC, LFA, etc.) e métodos de encerramento.',
  },
  {
    name: 'ONE Championship',
    href: 'https://www.onefc.com',
    use: 'Official ONE Championship event cards, results, fighter profiles, and divisional champions across MMA and Muay Thai.',
    usePt: 'Cards oficiais de eventos do ONE Championship, resultados, perfis de atletas e campeões das divisões de MMA e Muay Thai.',
  },
  {
    name: 'Sherdog',
    href: 'https://www.sherdog.com',
    use: 'Fighter career fight archives, historical records, physical attributes, and career lineages.',
    usePt: 'Arquivo histórico de lutas de carreira, cartéis oficiais, atributos físicos e fotos históricas de ex-lutadores.',
  },
  {
    name: 'Wikipedia',
    href: 'https://en.wikipedia.org',
    use: 'Complete professional MMA fight records, tournament Grand Prix brackets (Predador FC, Jungle Fight, PRIDE, WEC, Strikeforce), and historical title lineages (CC BY-SA 4.0).',
    usePt: 'Registros completos de lutas de MMA profissional, chaves de torneios Grand Prix e históricos de reinados de cinturão sob licença Creative Commons (CC BY-SA 4.0).',
  },
  {
    name: 'Published UFC title histories',
    use: 'Champions, title reigns and the list of BMF title fights, compiled by hand.',
    usePt: 'Compilação manual do histórico de disputas de cinturão e lutas pelo cinturão BMF.',
  },
  {
    name: 'UFC data by scarekrow (Kaggle)',
    href: 'https://www.kaggle.com/datasets/scarekrow/ufc-data',
    use: 'The referee, scheduled rounds, title-fight flag and judges’ scores shown on fight cards (UFC_full_data_silver_v2.csv).',
    usePt: 'Árbitros, rounds previstos e pontuações dos juízes em cards históricos.',
  },
  {
    name: 'flagcdn.com',
    href: 'https://flagcdn.com',
    use: 'Country flag images.',
    usePt: 'Bandeiras oficiais dos países de origem dos atletas.',
  },
  {
    name: 'Google Fonts',
    href: 'https://fonts.google.com',
    use: 'Anton, Barlow and Barlow Condensed, all under the SIL Open Font License.',
    usePt: 'Tipografia Anton, Barlow e Barlow Condensed (SIL Open Font License).',
  },
  {
    name: 'UFC Historical Fight Dataset (1993–2026) (Kaggle)',
    href: 'https://www.kaggle.com/datasets/larissapavan/ufc-historical-fight-dataset-19942026',
    use: 'The author’s own dataset, published on Kaggle: the events, fights, fighters, rankings and title reigns this site is built on.',
    usePt: 'Dataset original publicado pela autora no Kaggle, servindo como base unificada de dados do projeto.',
  },
]

const SOURCE_USE_FR: Record<string, string> = {
  'UFCStats.com': 'Profils de lutteurs, événements, résultats et statistiques de carrière.',
  ESPN: "Événements, résultats, cartes à venir, palmarès, profils des nouveaux lutteurs, photos et les titres d'actualité des pages d'accueil et d'événements (chacun renvoie vers l'article d'origine). Aussi l'ensemble des archives du Bellator : événements, résultats, profils et portraits.",
  'UFC.com': "Classements officiels, photos des champions en titre et villes d'origine.",
  'UFC Stats Leaders': "Le livre des records officiel de l'UFC : leaders historiques en victoires, finishes, frappe, lutte et plus encore.",
  'roster.watch': "L'effectif de l'UFC, actuel et ancien : qui en fait partie, nationalités, dates de début et de dernier combat, et les badges d'origine et d'honneur (Contender Series, TUF, Road to UFC, BMF, Hall of Fame).",
  'pflmma.com': "Le site de la Professional Fighters League : événements, résultats, profils, portraits et classements officiels. Seules les pages autorisées par son robots.txt sont lues ; les portraits sont stockés ici en petites copies.",
  FightHub: "L'annuaire des salles et des équipes, et les lutteurs qui s'y entraînent, affiché sur les pages Salles et rapproché par le nom avec les lutteurs de chaque organisation. Seules les pages autorisées par son robots.txt sont lues.",
  'Next-Fight': 'Annonces de combats, cartes à venir, confirmations d’affrontements et avis de combats de titre (comme UFC 336: Prates vs. Morales).',
  Tapology: "Palmarès complets des combattants, historiques des combats à travers les circuits régionaux et mondiaux de MMA (Jungle Fight, Predador FC, LFA, etc.) et méthodes de victoire.",
  'ONE Championship': "Cartes officielles d'événements du ONE Championship, résultats, profils d'athlètes et champions des divisions de MMA et Muay Thai.",
  Sherdog: "Archives des combats de carrière, palmarès officiels, attributs physiques et photos d'archives.",
  Wikipedia: "Registres complets des combats professionnels de MMA, tableaux de tournois Grand Prix et historiques des règnes de titres (CC BY-SA 4.0).",
  'Published UFC title histories': 'Champions, règnes et la liste des combats pour le titre BMF, compilés à la main.',
  'UFC data by scarekrow (Kaggle)': 'L’arbitre, les rounds prévus, l’indicateur de combat de titre et les notes des juges affichés sur les cartes (UFC_full_data_silver_v2.csv).',
  'flagcdn.com': 'Images des drapeaux.',
  'Google Fonts': 'Anton, Barlow et Barlow Condensed, toutes sous la SIL Open Font License.',
  'UFC Historical Fight Dataset (1993–2026) (Kaggle)': "Le jeu de données de l'autrice, publié sur Kaggle : les événements, combats, lutteurs, classements et règnes de titre sur lesquels ce site est construit.",
}

export function About() {
  const { t, i18n } = useTranslation()

  return (
    <div className="space-y-3 sm:space-y-4">
      <section className="page-hero rounded-[20px] px-3 py-3 sm:px-4 sm:py-4" aria-labelledby="about-title">
        <p className="broadcast-label text-[11px] text-[var(--text-muted)]">{t('about.eyebrow')}</p>
        <h1 id="about-title" className="mt-1.5 text-3xl font-bold uppercase tracking-[0.03em] text-[var(--text-main)] md:text-4xl">
          {t('about.title')}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
          {t('about.description')}
        </p>
      </section>

      <AboutSection id="who" icon={Users} title={t('about.who')}>
        <ul className="list-disc space-y-2 pl-5 marker:text-[#C8102E]">
          <li>{t('about.whoText1')}</li>
          <li>{t('about.whoText2')}</li>
          <li>{t('about.whoText3')}</li>
        </ul>
      </AboutSection>

      <AboutSection id="data" icon={Database} title={t('about.dataAndSystem')}>
        <p>
          {L(
            i18n.language,
            'Perfis de atletas, eventos, resultados e rankings são agregados a partir de fontes públicas (UFCStats.com, ESPN, Next-Fight e UFC.com; pflmma.com para a PFL; ESPN e Wikipedia para o Bellator; FightHub para as academias). O histórico de títulos é compilado e validado meticulosamente. Todas as previsões alimentam um pipeline independente de inteligência artificial com recursos de aprendizado de máquina treinados sobre registros históricos.',
            "Fighter profiles, events, results and rankings are collected from public sources (UFCStats.com, ESPN, Next-Fight and UFC.com; pflmma.com for the PFL; ESPN and Wikipedia for Bellator; FightHub for the gyms), the title history is compiled by hand from published UFC title records, and everything is saved as CSV files that an automated job refreshes daily. For each matchup the system compares the two fighters and feeds those differences into a machine-learning model that estimates each fighter's chance of winning.",
            "Les profils de lutteurs, les événements, les résultats et les classements sont collectés à partir de sources publiques (UFCStats.com, ESPN, Next-Fight et UFC.com ; pflmma.com pour la PFL ; ESPN et Wikipedia pour le Bellator ; FightHub pour les salles). L'historique des titres est compilé à la main à partir des historiques de titres UFC publiés, et le tout est enregistré en fichiers CSV qu'une tâche automatisée actualise chaque jour. Pour chaque affrontement, le système compare les deux lutteurs et transmet ces écarts à un modèle d'apprentissage automatique qui estime les chances de victoire de chacun.",
          )}
        </p>
      </AboutSection>

      <AboutSection id="disclaimer" icon={AlertTriangle} title={t('about.disclaimer')}>
        <ul className="list-disc space-y-2 pl-5 marker:text-[#C8102E]">
          <li>{t('about.disclaimerText1')}</li>
          <li>{t('about.disclaimerText2')}</li>
        </ul>
      </AboutSection>

      <AboutSection id="contact" icon={Mail} title={t('about.contact')}>
        <p>
          {t('about.contactText')}{' '}
          <ExternalAnchor href={GITHUB_PROFILE}>github.com/larissapavan</ExternalAnchor>{' '}
          {L(i18n.language, 'ou', 'or', 'ou')}{' '}
          <ExternalAnchor href={LINKEDIN_PROFILE}>LinkedIn</ExternalAnchor>.
        </p>

        <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5">
          <p className="font-mono text-xs uppercase tracking-wider text-[var(--text-main)] font-bold mb-2.5">
            {L(i18n.language, 'Canais Oficiais // Vektor MMA', 'Official Channels // Vektor MMA', 'Canaux Officiels // Vektor MMA')}
          </p>
          <div className="flex flex-wrap gap-4 text-xs font-medium">
            <a
              href="https://www.youtube.com/@Vektor-MMA"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[var(--text-main)] hover:text-[#FF0000] transition"
            >
              <YouTubeIcon className="h-4 w-4 text-[#FF0000]" />
              <span>YouTube: @Vektor-MMA</span>
            </a>
            <a
              href="https://www.instagram.com/vektormma"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[var(--text-main)] hover:text-[#E4405F] transition"
            >
              <InstagramIcon className="h-4 w-4 text-[#E4405F]" />
              <span>Instagram: @vektormma</span>
            </a>
            <a
              href="https://www.tiktok.com/@vektormma"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[var(--text-main)] hover:text-[#25F4EE] transition"
            >
              <TikTokIcon className="h-4 w-4 text-[#25F4EE]" />
              <span>TikTok: @vektormma</span>
            </a>
          </div>
        </div>

        <h3 className="broadcast-label mt-5 text-xs text-[var(--text-main)]">{t('about.sources')}</h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {sources.map((source) => (
            <li key={source.name} className="metric-tile rounded-xl px-3 py-2.5">
              <p className="text-sm font-semibold text-[var(--text-main)]">
                {source.href ? <ExternalAnchor href={source.href}>{source.name}</ExternalAnchor> : source.name}
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{L(i18n.language, source.usePt, source.use, SOURCE_USE_FR[source.name])}</p>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs leading-5 text-[var(--text-muted)]">
          {L(
            i18n.language,
            'Desenvolvido com tecnologias open-source: React, Vite, Tailwind CSS, Recharts, Framer Motion e Lucide no frontend; FastAPI, pandas, scikit-learn e SHAP no backend.',
            'Built with open-source software: React, Vite, Tailwind CSS, Recharts, Framer Motion and Lucide on the front end; FastAPI, pandas, scikit-learn and SHAP on the back end.',
            'Construit avec des logiciels open source : React, Vite, Tailwind CSS, Recharts, Framer Motion et Lucide côté interface ; FastAPI, pandas, scikit-learn et SHAP côté serveur.',
          )}
        </p>
      </AboutSection>
    </div>
  )
}

function AboutSection({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  title: string
  children: ReactNode
}) {
  return (
    <section className="surface-card rounded-[20px] p-3 sm:p-4" aria-labelledby={`about-${id}`}>
      <div className="flex items-center gap-2.5">
        <div className="rounded-xl bg-[#C8102E]/12 p-2 text-[#C8102E]">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <h2 id={`about-${id}`} className="text-2xl font-bold uppercase tracking-[0.03em] text-[var(--text-main)]">
          {title}
        </h2>
      </div>
      <div className="mt-3 max-w-3xl space-y-3 text-sm leading-6 text-[var(--text-secondary)]">{children}</div>
    </section>
  )
}

function ExternalAnchor({ href, children }: { href: string; children: ReactNode }) {
  const { i18n } = useTranslation()
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[var(--text-main)] underline decoration-[#C8102E]/70 underline-offset-4 transition hover:decoration-[#C8102E] focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8102E]"
    >
      {children}
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
      <span className="sr-only">{L(i18n.language, '(abre em nova aba)', '(opens in a new tab)', '(s’ouvre dans un nouvel onglet)')}</span>
    </a>
  )
}
