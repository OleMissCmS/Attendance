-- Banner / Ellucian Experience identifiers for midterm grade export.
alter table public.sections
  add column if not exists banner_crn text,
  add column if not exists banner_term_code text;

comment on column public.sections.banner_crn is
  'Ellucian Experience / Banner CRN for this section (from course listing).';
comment on column public.sections.banner_term_code is
  'Ellucian Experience / Banner term code (e.g. 202710) for grade import.';
