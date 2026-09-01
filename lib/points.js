// Logika bobot poin gamifikasi.
// Sumber: role & responsibility.xlsx — sheet "Bobot KPI" (bobot per level),
// sheet "RACI table" (peran), dan konvensi urgensi project ini.

// Kategori KPI (kolom tasks.kpi_category, migrasi 0012).
export const KPI_CATEGORIES = ['kualitas', 'produktivitas', 'efisiensi_cost', 'improvement', 'people_5s'];

export const KPI_CATEGORY_LABEL = {
  kualitas: 'Kualitas',
  produktivitas: 'Produktivitas',
  efisiensi_cost: 'Efisiensi & Cost',
  improvement: 'Improvement',
  people_5s: 'People & 5S',
};

// Bobot KPI per level jabatan — persis sheet "Bobot KPI".
// (Mirror dari seed point_rules di migrasi 0012; dipakai untuk preview client
// dan fallback bila tabel belum ter-apply. Sumber kebenaran: DB point_rules.)
export const POINT_RULES_DEFAULT = {
  operator:           { kualitas: 0.40, produktivitas: 0.30, efisiensi_cost: 0.10, improvement: 0.10, people_5s: 0.10 },
  supervisor:         { kualitas: 0.30, produktivitas: 0.30, efisiensi_cost: 0.20, improvement: 0.10, people_5s: 0.10 },
  asisten_manager:    { kualitas: 0.25, produktivitas: 0.25, efisiensi_cost: 0.25, improvement: 0.15, people_5s: 0.10 },
  section_manager:    { kualitas: 0.20, produktivitas: 0.25, efisiensi_cost: 0.25, improvement: 0.20, people_5s: 0.10 },
  department_manager: { kualitas: 0.15, produktivitas: 0.25, efisiensi_cost: 0.30, improvement: 0.20, people_5s: 0.10 },
};

// Multiplier peran RACI (sheet "RACI table"): eksekutor dapat poin penuh.
export const RACI_MULTIPLIER = { R: 1.0, A: 0.5, C: 0.25, I: 0 };

// Multiplier urgensi (mengikuti URGENCY_OPTIONS di lib/constants.js).
export const URGENCY_MULTIPLIER = { bisa_nunggu: 1, perlu_hari_ini: 1.25, mendesak: 1.5 };

// Poin dasar per task sebelum pembobotan (skala agar hasil ~ bobotPoin lama 5-30).
export const BASE_POINTS = 20;

// Map golongan (1-7) → level point_rules.
export function levelFromGolongan(golongan) {
  const g = Number(golongan) || 0;
  if (g >= 7) return 'section_manager';
  if (g === 6) return 'asisten_manager';
  if (g === 5) return 'supervisor';
  return 'operator';
}

/**
 * Hitung bobot poin task.
 * poin = basis × bobot(level, kategori) × RACI × urgensi — dibulatkan, min 1.
 *
 * @param {object} opts
 * @param {string} opts.kategoriKPI  salah satu KPI_CATEGORIES
 * @param {number} opts.golongan     golongan pelaksana (1-7)
 * @param {string} [opts.peranRACI]  'R' | 'A' | 'C' | 'I' (default 'R' = eksekutor)
 * @param {string} [opts.urgensi]    'bisa_nunggu' | 'perlu_hari_ini' | 'mendesak'
 * @param {number} [opts.basis]      poin dasar (default BASE_POINTS)
 * @param {object} [opts.rules]      bobot dari DB point_rules (fallback default)
 * @returns {number} poin bulat >= 1, atau 0 jika peran I / kategori tidak dikenal
 */
export function hitungPoin({ kategoriKPI, golongan, peranRACI = 'R', urgensi = 'bisa_nunggu', basis = BASE_POINTS, rules }) {
  const level = levelFromGolongan(golongan);
  const table = rules || POINT_RULES_DEFAULT;
  const bobot = table[level]?.[kategoriKPI];
  if (!bobot) return 0;
  const raci = RACI_MULTIPLIER[peranRACI] ?? 1;
  if (raci === 0) return 0;
  const urg = URGENCY_MULTIPLIER[urgensi] ?? 1;
  return Math.max(1, Math.round(basis * bobot * raci * urg));
}
