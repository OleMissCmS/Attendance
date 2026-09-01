"use client"

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { CheckinsVsExpectedDay } from "@/lib/scoped-usage-stats"
import { formatCentralMonthDay } from "@/lib/time"

const NAVY = "#000D26"
const SLATE = "#333F58"
const SKY = "#A1C6E7"
const GRID = "#E8ECF2"

const ACTUAL_LABEL = "Check-ins"
const EXPECTED_LABEL = "Expected (roster size)"

function DualAxisTooltip({
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

export function CheckinsExpectedChart({
  periodLabel,
  data,
}: {
  periodLabel: string
  data: CheckinsVsExpectedDay[]
}) {
  const chartData = data.map((row) => ({
    label: formatCentralMonthDay(`${row.date}T12:00:00`),
    [ACTUAL_LABEL]: row.actual,
    [EXPECTED_LABEL]: row.expected,
  }))

  const yMax = Math.max(
    1,
    ...chartData.flatMap((row) => [row[ACTUAL_LABEL], row[EXPECTED_LABEL]]),
  )
  const yDomain: [number, number] = [0, Math.ceil(yMax * 1.1)]

  return (
    <section className="rounded-xl border border-[#333F58]/15 bg-white p-6 xl:col-span-2">
      <h2 className="text-lg font-extrabold text-[#000D26]">
        Check-ins vs expected ({periodLabel})
      </h2>
      <p className="mt-1 text-sm text-[#333F58]">
        Class days only — expected is roster size at session start, summed per
        session that day. Bars and line share the same scale.
      </p>
      <div className="mt-6 h-80">
        {chartData.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
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
                yAxisId="shared"
                domain={yDomain}
                allowDecimals={false}
                tick={{ fill: SLATE, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip content={<DualAxisTooltip />} />
              <Legend
                verticalAlign="top"
                height={36}
                formatter={(value) => (
                  <span className="text-xs text-[#333F58]">{value}</span>
                )}
              />
              <Bar
                yAxisId="shared"
                dataKey={ACTUAL_LABEL}
                fill={NAVY}
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
              <Line
                yAxisId="shared"
                type="monotone"
                dataKey={EXPECTED_LABEL}
                stroke={SKY}
                strokeWidth={2.5}
                dot={{ r: 3, fill: SKY, stroke: SLATE, strokeWidth: 1 }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-[#333F58]">
            No class days in {periodLabel.toLowerCase()}.
          </p>
        )}
      </div>
    </section>
  )
}
