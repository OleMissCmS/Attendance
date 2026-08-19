"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { FacultyStats } from "@/lib/attendance-stats"
import { formatAttendanceRate } from "@/lib/attendance-stats"

const NAVY = "#000D26"
const SLATE = "#333F58"
const SKY = "#A1C6E7"
const GRID = "#E8ECF2"

function percentTick(value: number) {
  return `${Math.round(value * 100)}%`
}

function ChartTooltip({
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
          {item.name}: {formatAttendanceRate(Number(item.value))}
        </p>
      ))}
    </div>
  )
}

export function FacultyStatsCharts({ stats }: { stats: FacultyStats }) {
  const timeData = stats.overTime.map((row) => ({
    ...row,
    Attendance: row.rate,
  }))
  const sectionData = stats.sections
    .filter((row) => row.sessionCount > 0)
    .map((row) => ({
      name: `${row.courseCode} · ${row.sectionLabel}`,
      Attendance: row.rate,
    }))
  const courseData = stats.byCourse
    .filter((row) => row.sessionCount > 0)
    .map((row) => ({
      name: row.label,
      Attendance: row.rate,
    }))

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-xl border border-[#333F58]/15 bg-white p-6 xl:col-span-2">
        <h2 className="text-lg font-extrabold text-[#000D26]">
          Attendance over time
        </h2>
        <p className="mt-1 text-sm text-[#333F58]">
          Combined present / expected check-ins for all authorized sections,
          by session date.
        </p>
        <div className="mt-6 h-80">
          {timeData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1">
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
                  domain={[0, 1]}
                  tickFormatter={percentTick}
                  tick={{ fill: SLATE, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="Attendance"
                  stroke={NAVY}
                  strokeWidth={2.5}
                  fill="url(#attendanceFill)"
                  activeDot={{ r: 5, fill: NAVY }}
                >
                  <LabelList
                    dataKey="Attendance"
                    position="top"
                    formatter={(value) =>
                      formatAttendanceRate(Number(value ?? 0))
                    }
                    fill={SLATE}
                    fontSize={11}
                  />
                </Area>
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-[#333F58]">
              No dated sessions to chart yet.
            </p>
          )}
        </div>
        {timeData.length ? (
          <table className="sr-only">
            <caption>Attendance over time</caption>
            <thead>
              <tr>
                <th>Date</th>
                <th>Attendance</th>
              </tr>
            </thead>
            <tbody>
              {timeData.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{formatAttendanceRate(row.Attendance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section className="rounded-xl border border-[#333F58]/15 bg-white p-6">
        <h2 className="text-lg font-extrabold text-[#000D26]">
          Sections compared
        </h2>
        <p className="mt-1 text-sm text-[#333F58]">
          Attendance rate by section.
        </p>
        <div className="mt-6 h-80">
          {sectionData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sectionData}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid stroke={GRID} horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 1]}
                  tickFormatter={percentTick}
                  tick={{ fill: SLATE, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={128}
                  tick={{ fill: NAVY, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="Attendance"
                  fill={NAVY}
                  radius={[0, 6, 6, 0]}
                  maxBarSize={28}
                >
                  <LabelList
                    dataKey="Attendance"
                    position="right"
                    formatter={(value) =>
                      formatAttendanceRate(Number(value ?? 0))
                    }
                    fill={SLATE}
                    fontSize={11}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-[#333F58]">
              No section sessions to compare.
            </p>
          )}
        </div>
        {sectionData.length ? (
          <table className="sr-only">
            <caption>Sections compared</caption>
            <thead>
              <tr>
                <th>Section</th>
                <th>Attendance</th>
              </tr>
            </thead>
            <tbody>
              {sectionData.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{formatAttendanceRate(row.Attendance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section className="rounded-xl border border-[#333F58]/15 bg-white p-6">
        <h2 className="text-lg font-extrabold text-[#000D26]">
          Courses compared
        </h2>
        <p className="mt-1 text-sm text-[#333F58]">
          Average attendance rate per course.
        </p>
        <div className="mt-6 h-80">
          {courseData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={courseData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: SLATE, fontSize: 11 }}
                  axisLine={{ stroke: GRID }}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  domain={[0, 1]}
                  tickFormatter={percentTick}
                  tick={{ fill: SLATE, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="Attendance"
                  fill={SLATE}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                >
                  <LabelList
                    dataKey="Attendance"
                    position="top"
                    formatter={(value) =>
                      formatAttendanceRate(Number(value ?? 0))
                    }
                    fill={SLATE}
                    fontSize={11}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-[#333F58]">
              No course sessions to compare.
            </p>
          )}
        </div>
        {courseData.length ? (
          <table className="sr-only">
            <caption>Courses compared</caption>
            <thead>
              <tr>
                <th>Course</th>
                <th>Attendance</th>
              </tr>
            </thead>
            <tbody>
              {courseData.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{formatAttendanceRate(row.Attendance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </div>
  )
}
