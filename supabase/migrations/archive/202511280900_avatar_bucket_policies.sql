-- Ensure the avatar bucket exists (public for direct URL access)
insert into storage.buckets (id, name, public)
values ('avatar', 'avatar', true)
on conflict (id) do nothing;

-- Allow authenticated users to insert into the avatar bucket
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and polname = 'Avatar insert'
  ) then
    create policy "Avatar insert"
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id = 'avatar' and owner = auth.uid());
  end if;
end
$$;

-- Allow public read access to files in the avatar bucket
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and polname = 'Avatar select'
  ) then
    create policy "Avatar select"
      on storage.objects
      for select
      to public
      using (bucket_id = 'avatar');
  end if;
end
$$;

-- Allow owners to update their own objects in the avatar bucket
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and polname = 'Avatar update'
  ) then
    create policy "Avatar update"
      on storage.objects
      for update
      to authenticated
      using (bucket_id = 'avatar' and owner = auth.uid())
      with check (bucket_id = 'avatar' and owner = auth.uid());
  end if;
end
$$;

-- Allow owners to delete their own objects in the avatar bucket
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and polname = 'Avatar delete'
  ) then
    create policy "Avatar delete"
      on storage.objects
      for delete
      to authenticated
      using (bucket_id = 'avatar' and owner = auth.uid());
  end if;
end
$$;
