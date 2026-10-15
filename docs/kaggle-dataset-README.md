# UFC Historical Fight Dataset (1993–2026)

Every UFC event, fight and fighter from the first card in November 1993 through October 2026, plus current rankings, title reigns and upcoming cards. It is the data behind [Fight Intelligence](https://fight-intelligence.vercel.app/), a UFC analytics and fight-prediction site.

- **Events:** 794, from 1993-11-12 to 2026-10-10
- **Fights:** about 8,900
- **Fighters:** about 4,500
- **Last updated:** October 2026

## Files

| File | Rows | What it contains |
| --- | --- | --- |
| `events.csv` | 794 | One row per event: name, date, UFCStats URL. |
| `fights.csv` | 8,945 | One row per fight: event, both fighters, weight class, method, round and time. |
| `event_cards.csv` | 8,944 | The same fights with the extra columns `location`, `winner` and `method_detail`. Use this file when you need to know who won. |
| `fighters.csv` | 4,547 | Fighter profiles: name, nickname, height, weight, reach, stance, record. |
| `fighter_career_stats.csv` | 4,547 | Career averages per fighter (striking, takedowns, submissions) and date of birth. |
| `rankings.csv` | 206 | Current official divisional and pound-for-pound rankings. |
| `title_reigns.csv` | 173 | Every title reign: champion, how it was won, days held, defenses, how it ended. |
| `upcoming_events.csv` | 71 | Scheduled cards that have not happened yet. |

Fighters link across files through `fighter_url` (the UFCStats profile URL), and fights through `fight_url`. Fighters are also identified by name in `fights.csv`, `event_cards.csv` and `rankings.csv`.

## Columns

**fights.csv**
`event_name`, `event_date`, `fight_url`, `fighter_1`, `fighter_2`, `weight_class`, `method`, `round`, `time`

**event_cards.csv**
`event_name`, `event_date`, `location`, `event_url`, `fight_url`, `fighter_1`, `fighter_2`, `winner`, `weight_class`, `method`, `method_detail`, `round`, `time`

**fighters.csv**
`first_name`, `last_name`, `nickname`, `height`, `weight`, `reach`, `stance`, `wins`, `losses`, `draws`, `belt`, `fighter_url`

**fighter_career_stats.csv**
`fighter_url`, `dob`, `sig_str_acc`, `takedown_acc`, `slpm` (significant strikes landed per minute), `sapm` (absorbed per minute), `str_def`, `td_avg` (takedowns per 15 min), `td_def`, `sub_avg` (submission attempts per 15 min), `wins`, `losses`, `draws`

**rankings.csv**
`category`, `is_p4p`, `rank` (0 is the champion), `fighter`, `rank_change`, `athlete_url`

**title_reigns.csv**
`division`, `reign_order`, `reign_no_label`, `title_type` (undisputed or interim), `champion`, `fighter_url`, `fighter_reign_index`, `won_how`, `opponent_beaten`, `event`, `location`, `date_won`, `date_won_raw`, `days_held`, `is_current`, `defenses_count`, `defenses_detail`, `end_reason`

**upcoming_events.csv** uses the same columns as `event_cards.csv`.

## Things to know before you use it

- **Dates are text**, for example `May 16, 2026`. Parse them with `pd.to_datetime`.
- **Winner:** `fights.csv` has no `winner` column. The label lives in `event_cards.csv` (`winner`), which is empty for draws and no contests. In every fight that has a winner, the winner is listed as `fighter_1`, so the fighter order leaks the label: shuffle the two fighters before building a prediction model.
- **Missing values:** heights, reach and some other fields use `--` when unknown. `nickname` is empty for about 45% of fighters and `stance` for about 19%.
- **`belt` in `fighters.csv` is empty** and should not be used. Use `title_reigns.csv` to find champions.
- **Units:** `height` is feet and inches (`5' 11"`), `weight` is pounds, `reach` is inches, and accuracy and defense columns are percentages stored as text (`42%`).
- **Names are not unique keys.** Use `fighter_url` when joining.
- **Title reigns are compiled by hand** from published UFC title histories and are the most likely file to have gaps or mistakes.
- `fights.csv` and `event_cards.csv` hold the same fights. A few have no `fight_url`.

## Sources and how it is built

The historical records come from [UFCStats](http://ufcstats.com). Recent events, results and upcoming cards are updated from ESPN, and the rankings come from ufc.com. The files are produced by scrapers and cleaned and validated before each update (same columns, no unexpected drop in rows).

## Ideas for use

Fight outcome prediction, fighter style clustering, career trajectory and aging analysis, finishing-rate trends by division, title-reign analysis, and exploratory data analysis and visualization.

## Disclaimer

This is an independent project, not affiliated with or endorsed by the UFC, Zuffa, TKO or any fighter. UFC and related marks belong to their owners. The data may contain errors or gaps, and the statistics are not official. It is shared for research, analytics and learning. It is not betting advice.

## Author

Made by Larissa Pavan · [GitHub](https://github.com/larissapavan) · [Fight Intelligence](https://fight-intelligence.vercel.app/)
