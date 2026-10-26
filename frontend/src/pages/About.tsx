import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Database, ExternalLink, Mail, Users } from 'lucide-react'

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
    name: 'Wikipedia',
    href: 'https://en.wikipedia.org/wiki/List_of_Bellator_MMA_champions',
    use: 'The list of Bellator MMA champions: every title reign, which gives the champions Bellator ended with and flags its title fights. Text from Wikipedia contributors, available under the Creative Commons Attribution-ShareAlike license (CC BY-SA 4.0); only facts (names, dates, divisions) are taken from it.',
    usePt: 'Histórico de reinados e campeões do Bellator MMA sob licença Creative Commons (CC BY-SA 4.0).',
  },
  {
    name: 'Sherdog',
    href: 'https://www.sherdog.com',
    use: 'A few archive photos of former fighters.',
    usePt: 'Fotos históricas de arquivo de ex-lutadores.',
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

export function About() {
  const { t, i18n } = useTranslation()
  const isPt = Boolean(i18n.language?.startsWith('pt'))

  return (
    <div className="space-y-3 sm:space-y-4">
      <section className="page-hero rounded-[20px] px-3 py-3 sm:px-4 sm:py-4" aria-labelledby="about-title">
        <p className="broadcast-label text-[11px] text-[#999999]">{t('about.eyebrow')}</p>
        <h1 id="about-title" className="mt-1.5 text-3xl font-bold uppercase tracking-[0.03em] text-[var(--text-main)] md:text-4xl">
          {t('about.title')}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#CCCCCC]">
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
          {isPt ? (
            <>
              Perfis de atletas, eventos, resultados e rankings são agregados a partir de fontes públicas (UFCStats.com, ESPN, Next-Fight e UFC.com; pflmma.com para a PFL; ESPN e Wikipedia para o Bellator; FightHub para as academias). O histórico de títulos é compilado e validado meticulosamente. Todas as previsões alimentam um pipeline independente de inteligência artificial com recursos de aprendizado de máquina treinados sobre registros históricos.
            </>
          ) : (
            <>
              Fighter profiles, events, results and rankings are collected from public sources (UFCStats.com, ESPN, Next-Fight and UFC.com; pflmma.com for the PFL; ESPN and Wikipedia for Bellator; FightHub for the gyms), the title history is compiled by hand from published UFC title records, and everything is saved as CSV files that an automated job refreshes daily. For each matchup the system compares the two fighters and feeds those differences into a machine-learning model that estimates each fighter&apos;s chance of winning.
            </>
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
          <ExternalAnchor href={GITHUB_PROFILE}>github.com/larissapavan</ExternalAnchor> ou{' '}
          <ExternalAnchor href={LINKEDIN_PROFILE}>LinkedIn</ExternalAnchor>.
        </p>

        <h3 className="broadcast-label mt-5 text-xs text-[var(--text-main)]">{t('about.sources')}</h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {sources.map((source) => (
            <li key={source.name} className="metric-tile rounded-xl px-3 py-2.5">
              <p className="text-sm font-semibold text-[var(--text-main)]">
                {source.href ? <ExternalAnchor href={source.href}>{source.name}</ExternalAnchor> : source.name}
              </p>
              <p className="mt-1 text-xs leading-5 text-[#999999]">{isPt ? source.usePt : source.use}</p>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs leading-5 text-[#999999]">
          {isPt
            ? 'Desenvolvido com tecnologias open-source: React, Vite, Tailwind CSS, Recharts, Framer Motion e Lucide no frontend; FastAPI, pandas, scikit-learn e SHAP no backend.'
            : 'Built with open-source software: React, Vite, Tailwind CSS, Recharts, Framer Motion and Lucide on the front end; FastAPI, pandas, scikit-learn and SHAP on the back end.'}
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
      <div className="mt-3 max-w-3xl space-y-3 text-sm leading-6 text-[#CCCCCC]">{children}</div>
    </section>
  )
}

function ExternalAnchor({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[var(--text-main)] underline decoration-[#C8102E]/70 underline-offset-4 transition hover:decoration-[#C8102E] focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8102E]"
    >
      {children}
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}
