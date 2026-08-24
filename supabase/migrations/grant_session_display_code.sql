-- Ensure projector/check-in RPCs keep EXECUTE after CREATE OR REPLACE.
grant execute on function public.session_display_code(uuid) to authenticated;
grant execute on function public.code_expires_in(uuid, text) to anon, authenticated;
grant execute on function public.check_in(uuid, text, text, text, uuid, boolean, boolean) to anon, authenticated;
