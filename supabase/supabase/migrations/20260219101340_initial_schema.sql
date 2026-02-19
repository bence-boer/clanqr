-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Project status enum
create type project_status as enum ('Active', 'Archived');

-- Feature status enum
create type feature_status as enum ('Draft', 'Submitted', 'In_Progress', 'Done');

-- Task status enum
create type task_status as enum ('Pending_Approval', 'Approved', 'In_Progress', 'Complete');

-- Resource status enum
create type resource_status as enum ('Pending', 'Fetched', 'Error');

-- Projects table
create table projects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  status project_status not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Features table
create table features (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text,
  status feature_status not null default 'Draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Resources table
create table resources (
  id uuid primary key default uuid_generate_v4(),
  feature_id uuid not null references features(id) on delete cascade,
  url text not null,
  title text,
  status resource_status not null default 'Pending',
  created_at timestamptz not null default now()
);

-- Tasks table
create table tasks (
  id uuid primary key default uuid_generate_v4(),
  feature_id uuid not null references features(id) on delete cascade,
  description text not null,
  status task_status not null default 'Pending_Approval',
  agent_log text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index idx_features_project_id on features(project_id);
create index idx_features_status on features(status);
create index idx_resources_feature_id on resources(feature_id);
create index idx_tasks_feature_id on tasks(feature_id);
create index idx_tasks_status on tasks(status);

-- Updated_at triggers
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at
  before update on projects
  for each row execute function update_updated_at();

create trigger features_updated_at
  before update on features
  for each row execute function update_updated_at();

create trigger tasks_updated_at
  before update on tasks
  for each row execute function update_updated_at();

-- Enable RLS (but allow all for local dev)
alter table projects enable row level security;
alter table features enable row level security;
alter table resources enable row level security;
alter table tasks enable row level security;

-- Permissive policies for local development
create policy "Allow all on projects" on projects for all using (true) with check (true);
create policy "Allow all on features" on features for all using (true) with check (true);
create policy "Allow all on resources" on resources for all using (true) with check (true);
create policy "Allow all on tasks" on tasks for all using (true) with check (true);