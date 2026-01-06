-- Restore storage policies for avatar and event-media buckets

-- Buckets (ensure exist)
insert into storage.buckets (id, name, public)
values ('avatar', 'avatar', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('event-media', 'event-media', true)
on conflict (id) do nothing;

-- Avatar policies
create policy "Avatar insert"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'avatar' and owner = auth.uid());

create policy "Avatar select"
  on storage.objects
  for select
  to public
  using (bucket_id = 'avatar');

create policy "Avatar update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'avatar' and owner = auth.uid())
  with check (bucket_id = 'avatar' and owner = auth.uid());

create policy "Avatar delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'avatar' and owner = auth.uid());

-- Event-media policies
create policy "Event media insert"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'event-media' and owner = auth.uid());

create policy "Event media select"
  on storage.objects
  for select
  to public
  using (bucket_id = 'event-media');

create policy "Event media update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'event-media' and owner = auth.uid())
  with check (bucket_id = 'event-media' and owner = auth.uid());

create policy "Event media delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'event-media' and owner = auth.uid());
