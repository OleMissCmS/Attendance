-- FERPA: do not expose a student's course list from email hash alone.
DROP FUNCTION IF EXISTS public.student_live_classes(text, boolean);
