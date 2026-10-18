create extension if not exists "uuid-ossp";

alter table public.files
  add column if not exists size_bytes bigint;

alter table public.generated_content
  add column if not exists format text,
  add column if not exists request_id uuid,
  add column if not exists source_file_name text,
  add column if not exists study_state jsonb;

update public.generated_content
set format = type
where format is null;

update public.generated_content
set request_id = gen_random_uuid()
where request_id is null;

update public.generated_content
set study_state = '{}'::jsonb
where study_state is null;

alter table public.generated_content
  alter column format set not null,
  alter column request_id set default gen_random_uuid(),
  alter column request_id set not null,
  alter column study_state set default '{}'::jsonb,
  alter column study_state set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'generated_content_format_check'
      and conrelid = 'public.generated_content'::regclass
  ) then
    alter table public.generated_content
      add constraint generated_content_format_check
      check (format in ('summary', 'flashcards', 'mcq', 'true_false', 'identification', 'mock_exam'));
  end if;
end $$;

create unique index if not exists idx_generated_content_user_request
  on public.generated_content(user_id, request_id);
