import type { ComponentType, ReactNode } from 'react'
import { AlertTriangle, Database, ExternalLink, Mail, Users } from 'lucide-react'

const GITHUB_PROFILE = 'https://github.com/larissapavan'
const LINKEDIN_PROFILE = 'https://www.linkedin.com/in/larissacpavan/'

const sources: { name: string; href?: string; use: string }[] = [
  {
    name: 'UFCStats.com',
    href: 'http://ufcstats.com',
    use: 'Fighter profiles, events, fight results and career stats.',
  },
  {
    name: 'ESPN',
    href: 'https://www.espn.com/mma/',
    use: 'Events, results, upcoming cards, fighter records, new-fighter profiles, fighter photos and the news headlines on the home and events pages (each links back to the original story).',
  },
  {
    name: 'UFC.com',
    href: 'https://www.ufc.com/rankings',
    use: 'Official rankings, the current champions’ photos and hometowns.',
  },
  {
    name: 'UFC Stats Leaders',
    href: 'https://statleaders.ufc.com/en/career',
    use: 'The UFC\u2019s official career Record Book: all-time leaders in wins, finishes, striking, grappling and more.',
  },
  {
    name: 'roster.watch',
    href: 'https://www.roster.watch/',
    use: 'The UFC roster, current and former: who is on it, nationalities, debut and last fight dates, and the origin and honor badges (Contender Series, TUF, Road to UFC, BMF, Hall of Fame).',
  },
  {
    name: 'Sherdog',
    href: 'https://www.sherdog.com',
    use: 'A few archive photos of former fighters.',
  },
  {
    name: 'Published UFC title histories',
    use: 'Champions, title reigns and the list of BMF title fights, compiled by hand.',
  },
  {
    name: 'UFC data by scarekrow (Kaggle)',
    href: 'https://www.kaggle.com/datasets/scarekrow/ufc-data',
    use: 'The referee, scheduled rounds, title-fight flag and judges’ scores shown on fight cards (UFC_full_data_silver_v2.csv).',
  },
  {
    name: 'flagcdn.com',
    href: 'https://flagcdn.com',
    use: 'Country flag images.',
  },
  {
    name: 'Google Fonts',
    href: 'https://fonts.google.com',
    use: 'Anton, Barlow and Barlow Condensed, all under the SIL Open Font License.',
  },
  {
    name: 'UFC Historical Fight Dataset (1993–2026) (Kaggle)',
    href: 'https://www.kaggle.com/datasets/larissapavan/ufc-historical-fight-dataset-19942026',
    use: 'The author’s own dataset, published on Kaggle: the events, fights, fighters, rankings and title reigns this site is built on.',
  },
]

export function About() {
  return (
    <div className="space-y-3 sm:space-y-4">
      <section className="page-hero rounded-[20px] px-3 py-3 sm:px-4 sm:py-4" aria-labelledby="about-title">
        <p className="broadcast-label text-[11px] text-[#999999]">About</p>
        <h1 id="about-title" className="mt-1.5 text-3xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF] md:text-4xl">
          An independent fan project
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#CCCCCC]">
          Who builds this, where the data comes from, and what its limits are.
        </p>
      </section>

      <AboutSection id="who" icon={Users} title="Who makes this">
        <ul className="list-disc space-y-2 pl-5 marker:text-[#C8102E]">
          <li>This project is built independently by an MMA fan.</li>
          <li>
            It has no affiliation, partnership, sponsorship or endorsement from the UFC, Zuffa LLC, TKO or any
            organization or athlete mentioned on this site.
          </li>
          <li>
            “UFC” and all fighter and event names are trademarks and names of their respective owners, used here for
            informational and study purposes only.
          </li>
        </ul>
      </AboutSection>

      <AboutSection id="data" icon={Database} title="Data & System">
        <p>
          Fighter profiles, events, results and rankings are collected from public sources (UFCStats.com, ESPN and
          UFC.com), the title history is compiled by hand from published UFC title records, and everything is saved as
          CSV files that an automated job refreshes once a day, after a validation step that rejects broken updates
          (title changes are still entered by hand, so a new champion can appear a little late). For each matchup the system compares the two fighters (age, height, reach, record, striking and
          takedown accuracy, stance) and feeds those differences into a machine-learning model that estimates each
          fighter’s chance of winning and shows which factors weighed most; the model was trained on a historical fight
          dataset published on Kaggle. Because the data comes from public pages that can change, it
          may contain errors, delays or gaps, the stats shown are not official, and the model uses each fighter’s
          current career numbers rather than their numbers at the time of past fights.
        </p>
      </AboutSection>

      <AboutSection id="disclaimer" icon={AlertTriangle} title="Important disclaimer">
        <ul className="list-disc space-y-2 pl-5 marker:text-[#C8102E]">
          <li>
            Predictions are statistical estimates, made as a hobby and for study. They are not a guarantee of any
            outcome and they are not betting advice.
          </li>
          <li>This site is not an official UFC product and does not speak for the UFC or for any athlete.</li>
        </ul>
      </AboutSection>

      <AboutSection id="contact" icon={Mail} title="Contact and credits">
        <p>
          Found a mistake in the data, or want something corrected? Get in touch through{' '}
          <ExternalAnchor href={GITHUB_PROFILE}>github.com/larissapavan</ExternalAnchor> or{' '}
          <ExternalAnchor href={LINKEDIN_PROFILE}>LinkedIn</ExternalAnchor>.
        </p>

        <h3 className="broadcast-label mt-5 text-xs text-[#FFFFFF]">Sources and credits</h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {sources.map((source) => (
            <li key={source.name} className="metric-tile rounded-xl px-3 py-2.5">
              <p className="text-sm font-semibold text-[#FFFFFF]">
                {source.href ? <ExternalAnchor href={source.href}>{source.name}</ExternalAnchor> : source.name}
              </p>
              <p className="mt-1 text-xs leading-5 text-[#999999]">{source.use}</p>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs leading-5 text-[#999999]">
          Built with open-source software: React, Vite, Tailwind CSS, Recharts, Framer Motion and Lucide on the
          front end; FastAPI, pandas, scikit-learn and SHAP on the back end.
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
        <h2 id={`about-${id}`} className="text-2xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">
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
      className="inline-flex items-center gap-1 text-[#FFFFFF] underline decoration-[#C8102E]/70 underline-offset-4 transition hover:decoration-[#C8102E] focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8102E]"
    >
      {children}
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}
