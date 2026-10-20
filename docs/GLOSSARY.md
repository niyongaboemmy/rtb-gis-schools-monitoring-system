# Glossary

> **Status: DRAFT for RTB review (decision D5).** Terms, definitions and the
> Kinyarwanda column need RTB sign-off. Until then, this draft is what the
> code uses: `client/src/lib/labels.ts` (enum labels), `client/src/lib/format.ts`
> (units) and `client/src/components/metric-help/metrics.ts` (metric help text).
> Formulas for every number are in [METRIC_DICTIONARY.md](METRIC_DICTIONARY.md).

One name per concept, in plain language that an RTB officer or school leader
understands.

## Scores and priorities

| Canonical term | Definition (one line) | Terms to avoid | Kinyarwanda |
|---|---|---|---|
| **School Condition Score** | A 0–100 score of a school's overall physical and operational condition. Higher is better. It combines six weighted components. | National Health Score, Health Score, Intelligence Score, Decision Score, Decision Intelligence Score, Overall Score, Composite Score | TBC by RTB |
| **Average School Condition Score** | The mean School Condition Score of the active schools you can see. | National Health Score, National Average | TBC by RTB |
| **Intervention Priority** | How urgently a school needs support, from its School Condition Score: **Critical** (< 35), **High** (35–54), **Medium** (55–74), **Low** (≥ 75). | Risk level (for this concept), Priority Score, AI priority | TBC by RTB |
| **Critical / High / Medium / Low** | The four Intervention Priority bands, always in this order. | URGENT, SEVERE, raw `critical` | TBC by RTB |
| **Months to Intervention** | Recommended time before action, from the score band: 0, 3, 6, 12, 18 or 36 months. | Urgency score | TBC by RTB |
| **Component** | One of the six inputs to the School Condition Score. | Sub-score, dimension, factor (for these six) | TBC by RTB |
| **Infrastructure (component, 35%)** | Average condition of the school's assessed buildings. | Infrastructure health index | TBC by RTB |
| **Building Age Score (component, 25%)** | A 0–100 score from the average age of the buildings. Newer buildings score higher. | Depreciation, Buildings Depreciation, Asset depreciation | TBC by RTB |
| **Facility Compliance (component, 15%)** | How many facility survey items are compliant: Compliant 100, Partially Compliant 50, Non-Compliant 0, averaged. | Facility score, survey score | TBC by RTB |
| **Accessibility (component, 10%)** | The road-access percentage recorded for the school. | Connectivity score | TBC by RTB |
| **Population Pressure (component, 10%)** | Capacity headroom compared with school-age population within 2 km. Higher means less pressure. | Capacity resilience, demographic score | TBC by RTB |
| **Resolution Rate (component, 5%)** | Share of the school's Issue Reports that are Resolved. | Solve rate | TBC by RTB |
| **Estimated — missing data** | The component had no data, so a neutral 50 was used. It is not a measured value. | Default, N/A shown as 50 | TBC by RTB |
| **Data Completeness** | Share of 10 key profile fields that are filled in. | Data quality score | TBC by RTB |
| **Indicative risk** | A rule-of-thumb risk estimate shown on the school dashboard. It is not part of the School Condition Score and is not a measurement. | Risk score (unqualified), AI risk | TBC by RTB |

## Issue reporting

| Canonical term | Definition (one line) | Terms to avoid | Kinyarwanda |
|---|---|---|---|
| **Issue Report** | A problem reported for a school or building by a school user. | Ticket, incident, report (alone when ambiguous) | TBC by RTB |
| **Pending** | Reported, not yet triaged. | Open (as a status), new | TBC by RTB |
| **Needs Intervention** | Triaged as needing action from RTB or the district. | NEED_INTERVENTION, Need intervention, Critical (for this status) | TBC by RTB |
| **Resolved** | The issue has been fixed. | Solved, SOLVED, Closed, Done | TBC by RTB |
| **Failed** | A repair was attempted and did not fix the issue. | FAILED, Rejected | TBC by RTB |
| **Open issues** | Pending + Needs Intervention + Failed. | Active issues (OK as a synonym on small cards only) | TBC by RTB |

## Schools, buildings and coverage

| Canonical term | Definition (one line) | Terms to avoid | Kinyarwanda |
|---|---|---|---|
| **Active school** | A school with status Active. Only active schools count in dashboards and analytics. | Operating, live | TBC by RTB |
| **Under Renovation** | A school temporarily closed for works. Excluded from analytics. | under_renovation | TBC by RTB |
| **TSS / VTC / Integrated School** | Technical Secondary School; Vocational Training Centre; a school that runs both. | INTEGRATED (raw) | TBC by RTB |
| **Building condition** | Good, Fair, Poor or Critical, recorded at inspection. | good/fair (lower-case raw) | TBC by RTB |
| **Capacity Utilisation** | Enrolled students ÷ programme seat capacity, as a percentage. Above 100% means over capacity. | Occupancy | TBC by RTB |
| **Student:Teacher Ratio** | Students per teacher, shown as "32:1". | STR | TBC by RTB |
| **Land area** | Used and unused land, in hectares (**ha**). | h, hect. | TBC by RTB |
| **Map Coverage** | Share of active schools with a processed site map (KMZ). | KMZ coverage | TBC by RTB |
| **Survey Coverage** | Share of active schools with at least one facility survey. | Survey completion rate | TBC by RTB |
| **Access level** | How much of the country a user can see: National, Province, District, Sector or School. | Scope tier, rank | TBC by RTB |

## Units (from `format.ts`)

| Quantity | Unit and precision |
|---|---|
| Length | m with 1 decimal (2D map) or 2 decimals (3D model); km from 1 km |
| Area | m²; from 1 ha also shown as ha, e.g. "1.25 ha (12,500 m²)" |
| Land area | ha, 2 decimals |
| Scores | whole numbers 0–100, no "%" sign |
| Percentages | whole numbers with "%", unless stated |
| Money | "RWF 1,250,000" or compact "RWF 1.3M" |
| Dates | "13 Oct 2026", Kigali time |
