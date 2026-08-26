// Mapping baris database → bentuk response API (sesuai API_SPEC.md).

export function mapTask(t) {
  if (!t) return null;
  return {
    taskId: t.id,
    judul: t.title,
    deskripsi: t.description,
    status: t.status,
    bobotPoin: t.points,
    deadline: t.deadline,
    assignedBy: t.assigned_by,
    assignedTo: t.assigned_to,
    createdAt: t.created_at,
  };
}

export function mapReport(r) {
  if (!r) return null;
  return {
    reportId: r.id,
    taskId: r.task_id,
    userId: r.user_id,
    catatan: r.progress_note,
    lampiranUrl: r.photo_url,
    status: r.status,
    createdAt: r.created_at,
  };
}

export function mapProblem(p) {
  if (!p) return null;
  return {
    problemId: p.id,
    taskId: p.task_id,
    userId: p.user_id,
    urgensi: p.urgency,
    deskripsiMasalah: p.description,
    status: p.status,
    keputusan: p.keputusan,
    createdAt: p.created_at,
  };
}

export function mapUser(u) {
  if (!u) return null;
  return {
    userId: u.id,
    nama: u.nama,
    npk: u.npk,
    golongan: u.golongan,
    title: u.title,
    atasanId: u.atasan_id,
    telegramChatId: u.telegram_chat_id,
  };
}
