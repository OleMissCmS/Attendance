import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"

const PAGE_SIZE = 1000

type PublicTable = keyof Database["public"]["Tables"]

/** Load every row for a `.in("session_id", …)` query past PostgREST’s default 1000-row cap. */
export async function fetchAllBySessionIds<T extends PublicTable>(
  supabase: SupabaseClient<Database>,
  table: T,
  sessionIds: string[],
  columns = "*",
): Promise<Database["public"]["Tables"][T]["Row"][]> {
  if (!sessionIds.length) return []

  const rows: Database["public"]["Tables"][T]["Row"][] = []
  let from = 0
  for (;;) {
    // Stable order is required; unordered .range() can skip/duplicate rows.
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .in("session_id", sessionIds)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      throw new Error(`${String(table)}: ${error.message}`)
    }

    const page = (data ?? []) as Database["public"]["Tables"][T]["Row"][]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return rows
}
