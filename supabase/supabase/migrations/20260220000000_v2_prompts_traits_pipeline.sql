-- V2 Schema: prompts, traits, skill_links, agent_runs, chat, pipeline columns

-- =====================
-- 1. prompts
-- =====================
create type prompt_role as enum ('manager', 'ralph');

create table prompts (
  id uuid primary key default uuid_generate_v4(),
  role prompt_role not null unique,
  content text not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table prompts enable row level security;
create policy "Allow all on prompts" on prompts for all using (true) with check (true);

-- =====================
-- 2. traits
-- =====================
create type trait_target as enum ('manager', 'ralph');

create table traits (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  target trait_target not null,
  content text not null,
  is_global boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger traits_updated_at
  before update on traits
  for each row execute function update_updated_at();

alter table traits enable row level security;
create policy "Allow all on traits" on traits for all using (true) with check (true);

-- =====================
-- 3. trait_assignments
-- =====================
create type assignment_scope as enum ('project', 'feature', 'task');

create table trait_assignments (
  id uuid primary key default uuid_generate_v4(),
  trait_id uuid not null references traits(id) on delete cascade,
  scope assignment_scope not null,
  project_id uuid references projects(id) on delete cascade,
  feature_id uuid references features(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  is_excluded boolean not null default false,
  assigned_by text not null default 'user',
  created_at timestamptz not null default now(),

  constraint valid_scope check (
    (scope = 'project' and project_id is not null and feature_id is null and task_id is null) or
    (scope = 'feature' and feature_id is not null and task_id is null) or
    (scope = 'task' and task_id is not null)
  )
);

create index idx_trait_assignments_trait on trait_assignments(trait_id);
create index idx_trait_assignments_project on trait_assignments(project_id);
create index idx_trait_assignments_feature on trait_assignments(feature_id);
create index idx_trait_assignments_task on trait_assignments(task_id);

alter table trait_assignments enable row level security;
create policy "Allow all on trait_assignments" on trait_assignments for all using (true) with check (true);

-- =====================
-- 4. skill_links
-- =====================
create table skill_links (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references tasks(id) on delete cascade,
  skill_name text not null,
  skill_path text,
  assigned_by text not null default 'user',
  created_at timestamptz not null default now(),
  unique(task_id, skill_name)
);

create index idx_skill_links_task on skill_links(task_id);

alter table skill_links enable row level security;
create policy "Allow all on skill_links" on skill_links for all using (true) with check (true);

-- =====================
-- 5. agent_runs
-- =====================
create type agent_type as enum ('manager', 'ralph', 'chat');
create type agent_run_status as enum ('queued', 'running', 'completed', 'failed', 'stopped');

create table agent_runs (
  id uuid primary key default uuid_generate_v4(),
  type agent_type not null,
  reference_id uuid,
  status agent_run_status not null default 'queued',
  model text,
  prompt_tokens integer,
  completion_tokens integer,
  duration_ms integer,
  log text,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_agent_runs_status on agent_runs(status);
create index idx_agent_runs_type on agent_runs(type);
create index idx_agent_runs_reference on agent_runs(reference_id);

alter table agent_runs enable row level security;
create policy "Allow all on agent_runs" on agent_runs for all using (true) with check (true);

-- =====================
-- 6. chat_sessions & chat_messages
-- =====================
create table chat_sessions (
  id uuid primary key default uuid_generate_v4(),
  title text,
  model text not null default 'claude-sonnet-4.5',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger chat_sessions_updated_at
  before update on chat_sessions
  for each row execute function update_updated_at();

create table chat_messages (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index idx_chat_messages_session on chat_messages(session_id);

alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;
create policy "Allow all on chat_sessions" on chat_sessions for all using (true) with check (true);
create policy "Allow all on chat_messages" on chat_messages for all using (true) with check (true);

-- =====================
-- 7. Modify tasks table
-- =====================
alter table tasks add column sort_order integer not null default 0;
alter table tasks add column retry_count integer not null default 0;
alter table tasks add column max_retries integer not null default 1;

-- =====================
-- 8. Modify features table
-- =====================
create type failure_behavior as enum ('stop', 'skip', 'retry');

alter table features add column on_task_failure failure_behavior not null default 'stop';
alter table features add column auto_approve boolean not null default false;
