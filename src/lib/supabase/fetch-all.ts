import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"

const PAGE_SIZE = 1000

type AttendanceRecord =
  Database["public"]["Tables"]["attendance_records"]["Row"]
type AttendanceFlag = Database["public"]["Tables"]["attendance_flags"]["Row"]

export async function fetchAllBySessionIds(
  supabase: SupabaseClient<Database>,
  table: "attendance_records",
  sessionIds: string[],
): Promise<AttendanceRecord[]>
export async function fetchAllBySessionIds(
  supabase: SupabaseClient<Database>,
  table: "attendance_flags",
  sessionIds: string[],
): Promise<AttendanceFlag[]>
export async function fetchAllBySessionIds(
  supabase: SupabaseClient<Database>,
  table: "attendance_records" | "attendance_flags",
  sessionIds: string[],
): Promise<AttendanceRecord[] | AttendanceFlag[]> {
  if (!sessionIds.length) return []

  const rows: AttendanceRecord[] | AttendanceFlag[] = []
  let from = 0
  for (;;) {
    // Stable order is required; unordered .range() can skip/duplicate rows.
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .in("session_id", sessionIds)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      throw new Error(`${table}: ${error.message}`)
    }

    const page = data ?? []
    ;(rows as unknown[]).push(...page)
    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return rows
}
