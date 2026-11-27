-- Run once in Supabase SQL Editor. Keep Supabase service_role key on Render SERVER ONLY.
create extension if not exists pgcrypto;
create table if not exists public.mg_batches (
 id uuid primary key default gen_random_uuid(),
 label text not null,
 zip_path text not null,
 created_at timestamptz not null default now()
);
create table if not exists public.mg_items (
 id uuid primary key default gen_random_uuid(),
 batch_id uuid not null references public.mg_batches(id) on delete cascade,
 folder_name text not null,
 topic text not null,
 source_path text not null,
 created_at timestamptz not null default now(),
 unique(batch_id,folder_name)
);
create table if not exists public.mg_versions (
 id uuid primary key default gen_random_uuid(),
 item_id uuid not null references public.mg_items(id) on delete cascade,
 version_no integer not null check(version_no>0),
 generated jsonb,
 imathas jsonb,
 error_message text,
 imathas_error text,
 status text not null check(status in ('generated','failed')),
 review_status text not null default 'pending' check(review_status in ('pending','approved','rejected')),
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(item_id,version_no)
);
create index if not exists mg_items_batch_idx on public.mg_items(batch_id);
create index if not exists mg_versions_item_idx on public.mg_versions(item_id,version_no desc);
alter table public.mg_batches enable row level security;
alter table public.mg_items enable row level security;
alter table public.mg_versions enable row level security;
-- Deliberately no public access policies: the Render server accesses via service_role.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('mathgpt-private','mathgpt-private',false,62914560,array['application/zip','application/json','application/octet-stream'])
on conflict (id) do nothing;
