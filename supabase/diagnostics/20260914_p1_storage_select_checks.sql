-- Read-only SEC-004 checks (DEV). Does not mutate.

-- 1. Public buckets
SELECT id, name, public
FROM storage.buckets
ORDER BY name;

-- 2. Storage SELECT policies
SELECT policyname, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- 3. Tables still without RLS
SELECT c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity = false
ORDER BY 1;
