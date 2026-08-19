export function formatSectionLabel(section: {
  term?: string | null
  section_number?: string | null
  label?: string | null
}) {
  const term = section.term?.trim() ?? ""
  const number = section.section_number?.trim() ?? ""
  if (term && number) return `${term} · ${number}`
  return section.label?.trim() || "Section"
}
