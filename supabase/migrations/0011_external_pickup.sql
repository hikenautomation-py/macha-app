-- 0011 external_requests pickup / reject
-- Adds picked_by, task_id, rejected_by and widens the status enum.

alter table public.external_requests
  add column if not exists picked_by uuid references public.users(id),
  add column if not exists task_id uuid references public.tasks(id),
  add column if not exists rejected_by uuid references public.users(id);

-- Widen status enum: open | picked | rejected | resolved.
alter table public.external_requests
  drop constraint if exists external_requests_status_check;

alter table public.external_requests
  add constraint external_requests_status_check
  check (status in ('open', 'picked', 'rejected', 'resolved'));

-- Fast lookup indexes.
create index if not exists idx_external_status on public.external_requests(status);
create index if not exists idx_external_picked_by on public.external_requests(picked_by);
