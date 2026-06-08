-- Lot 5 — RLS for user_preferences.
-- RLS is enabled on the table but no policy exists, so authenticated clients
-- currently cannot read or write their own preferences (default deny). Add
-- owner-scoped policies so the notification preferences screen can work.
-- (Writes via SECURITY DEFINER RPCs such as set_home_location are unaffected.)

drop policy if exists user_preferences_select_own on public.user_preferences;
create policy user_preferences_select_own on public.user_preferences
    for select to authenticated
    using (user_id = auth.uid());

drop policy if exists user_preferences_insert_own on public.user_preferences;
create policy user_preferences_insert_own on public.user_preferences
    for insert to authenticated
    with check (user_id = auth.uid());

drop policy if exists user_preferences_update_own on public.user_preferences;
create policy user_preferences_update_own on public.user_preferences
    for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
