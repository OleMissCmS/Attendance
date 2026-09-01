"use client"

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { AnalyticsPeriodSelector } from "@/components/analytics-period-selector"
import type { AnalyticsPeriod } from "@/lib/analytics-period"
import {
  FRICTION_LINE_LABELS,
  type FrictionPerDay,
} from "@/lib/friction-stats"
import { formatCentralMonthDay } from "@/lib/time"

const SLATE = "#333F58"
const GRID = "#E8ECF2"

const LINE_STYLES = {
  roster_add_requests: {
    color: "#0072B2",
    strokeDasharray: undefined,
  },
  roster_miss_attempts: {
    color: "#E69F00",
    strokeDasharray: "8 4",
  },
  incognito_checkins: {
    color: "#009E73",
    strokeDasharray: "2 4",
  },
  device_flags: {
    color: "#CE1126",
    strokeDasharray: undefined,
  },
} as const

function CountTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number; name: string; color?: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[#d5dbe3] bg-white px-3 py-2 shadow-sm">
      <p className="text-xs font-bold text-[#000D26]">{label}</p>
      {payload.map((item) => (
        <p key={item.name} className="text-xs text-[#333F58]">
          {item.name}: {item.value}
        </p>
      ))}
    </div>
  )
}

export function FrictionQualityChart({
  period,
  periodLabel,
  data,
  courses,
  sections,
}: {
  period: AnalyticsPeriod
  periodLabel: string
  data: FrictionPerDay[]
  courses?: string
  sections?: string
}) {
  const chartData = data.map((row) => ({
    label: formatCentralMonthDay(`${row.date}T12:00:00`),
    [FRICTION_LINE_LABELS.roster_add_requests]: row.roster_add_requests,
    [FRICTION_LINE_LABELS.roster_miss_attempts]: row.roster_miss_attempts,
    [FRICTION_LINE_LABELS.incognito_checkins]: row.incognito_checkins,
    [FRICTION_LINE_LABELS.device_flags]: row.device_flags,
  }))

  const yMax = Math.max(
    1,
    ...chartData.flatMap((row) =>
      Object.values(FRICTION_LINE_LABELS).map((label) => row[label] as number),
    ),
  )

  return (
    <section className="rounded-xl border border-[#333F58]/15 bg-white p-6 xl:col-span-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-[#000D26]">
            Friction/Quality
          </h2>
          <p className="mt-1 text-sm text-[#333F58]">
            Daily counts for roster-add requests, failed check-ins, incognito
            check-ins, and device flags (late device + conflict).{" "}
            {periodLabel.toLowerCase()}.
          </p>
        </div>
        <AnalyticsPeriodSelector
          period={period}
          courses={courses}
          sections={sections}
        />
      </div>
      <div className="mt-6 h-80">
        {chartData.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: SLATE, fontSize: 11 }}
                axisLine={{ stroke: GRID }}
                tickLine={false}
              />
              <YAxis
                domain={[0, Math.ceil(yMax * 1.1)]}
                allowDecimals={false}
                tick={{ fill: SLATE, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip content={<CountTooltip />} />
              <Legend
                verticalAlign="top"
                height={48}
                formatter={(value) => (
                  <span className="text-xs text-[#333F58]">{value}</span>
                )}
              />
              {(
                Object.entries(FRICTION_LINE_LABELS) as [
                  keyof typeof FRICTION_LINE_LABELS,
                  string,
                ][]
              ).map(([key, label]) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={label}
                  stroke={LINE_STYLES[key].color}
                  strokeWidth={2}
                  strokeDasharray={LINE_STYLES[key].strokeDasharray}
                  dot={{ r: 2, fill: LINE_STYLES[key].color }}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-[#333F58]">
            No friction events in {periodLabel.toLowerCase()}.
          </p>
        )}
      </div>
    </section>
  )
}
