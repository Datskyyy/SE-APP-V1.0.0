create extension if not exists "uuid-ossp";

create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text unique not null,
  created_at timestamptz default now()
);

create table if not exists files (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  mime_type text,
  storage_path text not null,
  size_bytes bigint,
  created_at timestamptz default now()
);

alter table files add column if not exists size_bytes bigint;

create table if not exists generated_content (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  file_id uuid references files(id) on delete set null,
  type text not null check (type in ('summary', 'flashcards', 'mcq', 'true_false', 'identification')),
  format text not null check (format in ('summary', 'flashcards', 'mcq', 'true_false', 'identification', 'mock_exam')),
  title text not null,
  content text not null,
  request_id uuid not null default gen_random_uuid(),
  source_file_name text,
  study_state jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table generated_content add column if not exists format text;
alter table generated_content add column if not exists request_id uuid;
alter table generated_content add column if not exists source_file_name text;
alter table generated_content add column if not exists study_state jsonb;

update generated_content set format = type where format is null;
update generated_content set request_id = gen_random_uuid() where request_id is null;
update generated_content set study_state = '{}'::jsonb where study_state is null;

alter table generated_content alter column format set not null;
alter table generated_content alter column request_id set default gen_random_uuid();
alter table generated_content alter column request_id set not null;
alter table generated_content alter column study_state set default '{}'::jsonb;
alter table generated_content alter column study_state set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'generated_content_format_check'
      and conrelid = 'generated_content'::regclass
  ) then
    alter table generated_content
      add constraint generated_content_format_check
      check (format in ('summary', 'flashcards', 'mcq', 'true_false', 'identification', 'mock_exam'));
  end if;
end $$;

create table if not exists activities (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  activity_type text not null,
  activity_date date not null,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists folders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists file_accesses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  file_id uuid not null references files(id) on delete cascade,
  access_date date not null,
  accessed_at timestamptz not null default now(),
  unique (user_id, file_id, access_date)
);

create table if not exists streaks (
  user_id uuid primary key references users(id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_activity_date date,
  updated_at timestamptz default now()
);

create table if not exists reviewers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  generated_content_id uuid not null references generated_content(id) on delete cascade,
  reviewer_type text not null check (reviewer_type in ('summary', 'flashcards')),
  title text not null,
  created_at timestamptz default now()
);

create table if not exists quizzes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  generated_content_id uuid not null references generated_content(id) on delete cascade,
  quiz_type text not null check (quiz_type in ('mcq', 'true_false', 'identification')),
  title text not null,
  score numeric(5,2),
  created_at timestamptz default now()
);

create table if not exists progress (
  user_id uuid primary key references users(id) on delete cascade,
  completion_rate numeric(5,2) default 0,
  total_reviewers int default 0,
  total_quizzes int default 0,
  updated_at timestamptz default now()
);

create index if not exists idx_generated_content_user_created on generated_content(user_id, created_at desc);
create unique index if not exists idx_generated_content_user_request on generated_content(user_id, request_id);
create index if not exists idx_activities_user_created on activities(user_id, created_at desc);
create index if not exists idx_folders_user_created on folders(user_id, created_at desc);
create index if not exists idx_file_accesses_user_date on file_accesses(user_id, access_date desc);
create index if not exists idx_file_accesses_user_recent on file_accesses(user_id, accessed_at desc);

alter table users enable row level security;
alter table files enable row level security;
alter table generated_content enable row level security;
alter table activities enable row level security;
alter table folders enable row level security;
alter table file_accesses enable row level security;
alter table streaks enable row level security;
alter table reviewers enable row level security;
alter table quizzes enable row level security;
alter table progress enable row level security;

drop policy if exists "users own record" on users;
create policy "users own record" on users
for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "files own records" on files;
create policy "files own records" on files
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "generated own records" on generated_content;
create policy "generated own records" on generated_content
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "activities own records" on activities;
create policy "activities own records" on activities
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "folders own records" on folders;
create policy "folders own records" on folders
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "file accesses own records" on file_accesses;
create policy "file accesses own records" on file_accesses
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "streaks own records" on streaks;
create policy "streaks own records" on streaks
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "reviewers own records" on reviewers;
create policy "reviewers own records" on reviewers
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "quizzes own records" on quizzes;
create policy "quizzes own records" on quizzes
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "progress own records" on progress;
create policy "progress own records" on progress
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "study files owner delete" on storage.objects;
create policy "study files owner delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'study-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

notify pgrst, 'reload schema';
