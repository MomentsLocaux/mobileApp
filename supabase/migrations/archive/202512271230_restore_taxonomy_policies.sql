-- Restore RLS read policies for taxonomy tables

create policy "event_category_select"
  on public.event_category
  for select
  to authenticated
  using (true);

create policy "event_subcategory_select"
  on public.event_subcategory
  for select
  to authenticated
  using (true);

create policy "event_tag_select"
  on public.event_tag
  for select
  to authenticated
  using (true);
