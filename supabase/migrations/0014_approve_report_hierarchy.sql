-- ============================================================
-- 0014 — approve_report: izin approval mengikuti hierarki
--
-- Sebelumnya RPC hanya menerima penyetuju yang persis sama dengan
-- `tasks.assigned_by`. Task hasil pick-up laporan/request bisa punya
-- `assigned_by` NULL (saat pick-up, `users.atasan_id` si picker masih
-- kosong), sehingga tidak ada satu pun user yang bisa menyetujuinya.
--
-- Aturan baru: penyetuju sah bila dia yang menugaskan task, ATAU dia
-- atasan (rekursif, lewat `users.atasan_id`) dari si pelaksana.
-- Jalankan via: supabase db push (atau tempel di Supabase SQL Editor).
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
  -- `is not distinct from` dipakai supaya NULL tidak membuat seluruh
  -- ekspresi jadi NULL (yang akan melewatkan pengecekan diam-diam).
  if not (
    v_task.assigned_by is not distinct from p_approved_by
    or exists (
      select 1
      from public.get_subordinate_ids(p_approved_by) s
      where s.id = v_task.assigned_to
    )
  ) then
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
