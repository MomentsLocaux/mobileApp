-- SCRUM-104 / Lumia documentary RAG (DRAFT — do NOT apply without human validation)
-- Enables pgvector + chunk store for semantic retrieval (prod path).

create extension if not exists vector with schema extensions;

create table if not exists public.lumia_doc_chunks (
  id text primary key,
  doc_id text not null,
  title text not null,
  category text not null default 'general',
  content text not null,
  embedding extensions.vector(1536) not null,
  updated_at timestamptz not null default now()
);

create index if not exists lumia_doc_chunks_embedding_idx
  on public.lumia_doc_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.lumia_doc_chunks enable row level security;
-- No client policies: Edge Function (service role) only.

comment on table public.lumia_doc_chunks is
  'Lumia RAG chunks (documentary base). Written by ingest job; read by lumia-chat Edge Function.';

create or replace function public.match_lumia_doc_chunks(
  query_embedding extensions.vector(1536),
  match_count int default 6,
  match_threshold float default 0.25
)
returns table (
  id text,
  doc_id text,
  title text,
  category text,
  content text,
  score float
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    c.id,
    c.doc_id,
    c.title,
    c.category,
    c.content,
    (1 - (c.embedding <=> query_embedding))::float as score
  from public.lumia_doc_chunks c
  where (1 - (c.embedding <=> query_embedding)) >= match_threshold
  order by c.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

revoke all on function public.match_lumia_doc_chunks from public;
grant execute on function public.match_lumia_doc_chunks to service_role;
