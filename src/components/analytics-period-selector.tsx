import { PERIOD_LABELS, type AnalyticsPeriod } from "@/lib/analytics-period"
import { Label } from "@/components/ui/label"

const selectClass =
  "h-9 rounded-md border bg-background px-3 text-sm"

export function AnalyticsPeriodSelector({
  period,
  courses,
  sections,
}: {
  period: AnalyticsPeriod
  courses?: string
  sections?: string
}) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      {courses ? <input type="hidden" name="courses" value={courses} /> : null}
      {sections ? (
        <input type="hidden" name="sections" value={sections} />
      ) : null}
      <div className="space-y-1">
        <Label htmlFor="period">Time period</Label>
        <select
          id="period"
          name="period"
          defaultValue={period}
          className={selectClass}
        >
          {(Object.keys(PERIOD_LABELS) as AnalyticsPeriod[]).map((key) => (
            <option key={key} value={key}>
              {PERIOD_LABELS[key]}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        className="inline-flex h-9 items-center rounded-md bg-[#000D26] px-4 text-sm font-bold text-white hover:bg-[#000D26]/90"
      >
        Apply
      </button>
    </form>
  )
}
