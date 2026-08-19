revoke all on function private.login_is_locked(text) from public, anon, authenticated;
revoke all on function private.record_failed_login(text) from public, anon, authenticated;
revoke all on function private.clear_own_login_failures() from public, anon, authenticated;
revoke all on function private.unlock_login_lockout_on_password_change() from public, anon, authenticated;

revoke execute on function public.clear_own_login_failures() from public, anon;
grant execute on function public.clear_own_login_failures() to authenticated;
