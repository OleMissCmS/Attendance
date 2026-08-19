export function isActiveRecord(row: { deleted_at?: string | null }) {
  return !row.deleted_at
}
