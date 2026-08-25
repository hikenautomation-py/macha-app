// Nilai urgensi problem report (format database).
export const URGENCY_OPTIONS = ['bisa_nunggu', 'perlu_hari_ini', 'mendesak'];

export const URGENCY_LABEL = {
  bisa_nunggu: 'Bisa nunggu',
  perlu_hari_ini: 'Perlu hari ini',
  mendesak: 'Mendesak',
};

/**
 * Normalisasi input urgensi (dari API/Telegram) ke format DB.
 * Menerima: "mendesak", "perlu hari ini", "bisa nunggu", atau format snake_case.
 */
export function normalizeUrgency(value) {
  const v = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (v === 'bisa_nunggu') return 'bisa_nunggu';
  if (v === 'perlu_hari_ini') return 'perlu_hari_ini';
  if (v === 'mendesak') return 'mendesak';
  return null;
}

// Label status task untuk UI.
export const TASK_STATUS_LABEL = {
  assigned: 'Task baru',
  in_progress: 'Sedang dikerjakan',
  report_submitted: 'Menunggu approval',
  approved: 'Selesai',
  rejected: 'Perlu revisi',
};

// Nama role berdasarkan golongan (untuk tampilan statistik/dashboard).
export function golonganLabel(g) {
  const n = Number(g) || 0;
  if (n >= 7) return 'Section Manager';
  if (n === 6) return 'Assistant Manager';
  if (n === 5) return 'Supervisor';
  if (n >= 2 && n <= 4) return 'Technician';
  if (n === 1) return 'Operator';
  return 'Intern';
}
