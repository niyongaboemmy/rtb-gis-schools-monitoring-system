import { formatNumber, formatPercent } from "../../../lib/format";
import type { ActionStatus, RecommendationActionRow } from "../recommendation-utils";
import { SummaryStat, SummaryStats } from "./primitives";

const DONE = "#10b981";
const IN_PROGRESS = "#f59e0b";

/** Header figures for the recommendations checklist. */
export function ActionsSummary({ items, actions }: { items: string[]; actions: RecommendationActionRow[] }) {
  const statusOf = (r: string): ActionStatus => actions.find((a) => a.recommendation === r)?.status ?? "open";
  const n = (s: ActionStatus) => items.filter((r) => statusOf(r) === s).length;
  const done = n("done");
  return (
    <SummaryStats cols={3}>
      <SummaryStat
        label="Done"
        value={`${formatNumber(done)} of ${formatNumber(items.length)}`}
        hint={items.length ? `${formatPercent((done / items.length) * 100)} complete` : "nothing to do"}
        accent={DONE}
        meter={items.length ? (done / items.length) * 100 : null}
      />
      <SummaryStat label="In progress" value={formatNumber(n("in_progress"))} accent={IN_PROGRESS} hint="being worked on" />
      <SummaryStat label="Open" value={formatNumber(n("open"))} hint="not started" />
    </SummaryStats>
  );
}
