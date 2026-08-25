-- ============================================================
-- RPC untuk approval completion report secara atomik.
-- Dipanggil dari Vercel Function (route approve) dengan service role.
-- ============================================================
create or replace function public.approve_report(
  p_task_id uuid,
  p_report_id uuid,
  p_approved_by uuid
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_task public.tasks%rowtype;
  v_points integer;
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'TASK_NOT_FOUND';
  end if;
  if v_task.status <> 'report_submitted' then
    raise exception 'INVALID_STATUS';
  end if;
  if v_task.assigned_by is distinct from p_approved_by then
    raise exception 'PERMISSION_DENIED';
  end if;
  if not exists (
    select 1 from public.task_reports where id = p_report_id and task_id = p_task_id
  ) then
    raise exception 'REPORT_NOT_FOUND';
  end if;

  update public.tasks set status = 'approved' where id = p_task_id;
  update public.task_reports set status = 'approved' where id = p_report_id;

  v_points := coalesce(v_task.points, 0);
  if v_points > 0 then
    insert into public.points_history (user_id, task_id, points, note)
    values (v_task.assigned_to, p_task_id, v_points, 'Poin task disetujui');
  end if;

  return json_build_object(
    'poinDitambahkan', v_points,
    'userId', v_task.assigned_to
  );
end;
$$;
