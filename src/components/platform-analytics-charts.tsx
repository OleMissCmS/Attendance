"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { PlatformUsageStats } from "@/lib/platform-usage-stats"
import { formatCentralMonthDay } from "@/lib/time"

const NAVY = "#000D26"
const SLATE = "#333F58"
const SKY = "#A1C6E7"
const GRID = "#E8ECF2"

function CountTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number; name: string }[]
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

export function PlatformAnalyticsCharts({ stats }: { stats: PlatformUsageStats }) {
  const periodLabel = stats.period.label
  const sessions = stats.series.sessions_per_day.map((row) => ({
    label: formatCentralMonthDay(`${row.date}T12:00:00`),
    Sessions: row.count,
  }))
  const checkins = stats.series.checkins_per_day.map((row) => ({
    label: formatCentralMonthDay(`${row.date}T12:00:00`),
    Checkins: row.count,
  }))
  const faculty = stats.series.faculty_signups_per_week_12w.map((row) => ({
    label: formatCentralMonthDay(`${row.week_start}T12:00:00`),
    Faculty: row.count,
  }))

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-xl border border-[#333F58]/15 bg-white p-6 xl:col-span-2">
        <h2 className="text-lg font-extrabold text-[#000D26]">
          Sessions per day ({periodLabel})
        </h2>
        <div className="mt-6 h-72">
          {sessions.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sessions} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="sessionsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={NAVY} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={SKY} stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: SLATE, fontSize: 12 }}
                  axisLine={{ stroke: GRID }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: SLATE, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<CountTooltip />} />
                <Area
                  type="monotone"
                  dataKey="Sessions"
                  stroke={NAVY}
                  fill="url(#sessionsFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-[#333F58]">
              No sessions in {periodLabel.toLowerCase()}.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-[#333F58]/15 bg-white p-6">
        <h2 className="text-lg font-extrabold text-[#000D26]">
          Check-ins per day ({periodLabel})
        </h2>
        <div className="mt-6 h-64">
          {checkins.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={checkins} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: SLATE, fontSize: 11 }}
                  axisLine={{ stroke: GRID }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: SLATE, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<CountTooltip />} />
                <Bar dataKey="Checkins" fill={NAVY} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-[#333F58]">
              No check-ins in {periodLabel.toLowerCase()}.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-[#333F58]/15 bg-white p-6">
        <h2 className="text-lg font-extrabold text-[#000D26]">
          Faculty signups per week (12 weeks)
        </h2>
        <div className="mt-6 h-64">
          {faculty.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={faculty} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: SLATE, fontSize: 11 }}
                  axisLine={{ stroke: GRID }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: SLATE, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<CountTooltip />} />
                <Bar dataKey="Faculty" fill={SKY} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-[#333F58]">No faculty signups in this window.</p>
          )}
        </div>
      </section>
    </div>
  )
}
