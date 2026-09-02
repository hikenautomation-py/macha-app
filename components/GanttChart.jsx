'use client';

// Gantt chart gaya spreadsheet (format gantt.xlsx):
// kolom = 5 bulan (bulan lalu, bulan ini, +1, +2, +3) × 4 minggu (W1–W4),
// baris = task per pelaksana. Bar mulai dari minggu task diberikan (created_at)
// sampai minggu deadline. Task approved diberi tanda ✓ Selesai.
// Dibungkus overflow-x auto agar bisa discroll horizontal di layar mobile.

const MONTH_LABEL = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const TOTAL_WEEKS = 20; // 5 bulan × 4 minggu

const COLOR = {
  selesai: '#7fb069', // hijau — approved
  terlambat: '#e2604f', // coral — lewat deadline
  normal: '#2f8f83', // teal — berjalan
};

// Index minggu global (0..19) dari sebuah tanggal, relatif ke awal bulan lalu.
// Tiap bulan dibagi 4 "minggu" (1-7, 8-14, 15-21, 22-akhir) sesuai format xlsx.
function weekIndex(dateStr, base) {
  const d = new Date(`${dateStr}T00:00:00`);
  const monthDiff = (d.getFullYear() - base.getFullYear()) * 12 + (d.getMonth() - base.getMonth());
  const week = Math.min(3, Math.floor((d.getDate() - 1) / 7));
  return monthDiff * 4 + week;
}

const th = {
  border: '1px solid #e3e0d8',
  padding: '4px 6px',
  fontSize: 11,
  fontWeight: 600,
  textAlign: 'center',
  whiteSpace: 'nowrap',
  background: '#faf8f2',
};
const cell = { border: '1px solid #e3e0d8', padding: 0, height: 28, minWidth: 26 };

export default function GanttChart({ gantt, multiUser }) {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth() - 1, 1); // awal bulan lalu
  const months = Array.from({ length: 5 }, (_, i) => {
    const m = new Date(base.getFullYear(), base.getMonth() + i, 1);
    return `${MONTH_LABEL[m.getMonth()]} ${m.getFullYear()}`;
  });
  const todayWeek = weekIndex(now.toISOString().slice(0, 10), base);

  const rows = (gantt || [])
    .map((t) => {
      const startRaw = t.mulai ? weekIndex(t.mulai, base) : todayWeek;
      // Tanpa deadline: bar 1 minggu di minggu mulai.
      const endRaw = t.deadline ? weekIndex(t.deadline, base) : startRaw;
      if (endRaw < 0 || startRaw > TOTAL_WEEKS - 1) return null; // di luar jendela
      const start = Math.max(0, Math.min(TOTAL_WEEKS - 1, startRaw));
      const end = Math.max(start, Math.min(TOTAL_WEEKS - 1, Math.max(startRaw, endRaw)));
      const warna = t.selesai ? COLOR.selesai : t.terlambat ? COLOR.terlambat : COLOR.normal;
      return { ...t, start, end, warna };
    })
    .filter(Boolean)
    .sort((a, b) => a.pelaksana.localeCompare(b.pelaksana) || a.start - b.start);

  if (rows.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Tidak ada task dalam jendela 5 bulan ini.</p>;
  }

  // Kelompokkan per pelaksana agar kolom Nama bisa di-rowSpan seperti xlsx.
  const groups = [];
  for (const r of rows) {
    const last = groups[groups.length - 1];
    if (last && last.pelaksana === r.pelaksana) last.items.push(r);
    else groups.push({ pelaksana: r.pelaksana, items: [r] });
  }

  return (
    <div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%' }}>
          <thead>
            <tr>
              {multiUser ? <th style={{ ...th, minWidth: 110 }} rowSpan={2}>Nama</th> : null}
              <th style={{ ...th, minWidth: 140, textAlign: 'left' }} rowSpan={2}>Job</th>
              {months.map((m, i) => (
                <th key={m} colSpan={4} style={{ ...th, background: i === 1 ? '#e2efed' : th.background }}>
                  {m}{i === 1 ? ' (bulan ini)' : ''}
                </th>
              ))}
            </tr>
            <tr>
              {months.flatMap((m) =>
                [1, 2, 3, 4].map((w) => (
                  <th key={`${m}-${w}`} style={{ ...th, fontWeight: 400, color: 'var(--ink-soft)' }}>W{w}</th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) =>
              g.items.map((r, ri) => (
                <tr key={r.taskId}>
                  {multiUser && ri === 0 ? (
                    <td rowSpan={g.items.length} style={{ ...cell, padding: '4px 6px', fontSize: 12, fontWeight: 600, verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                      {g.pelaksana}
                    </td>
                  ) : null}
                  <td
                    style={{ ...cell, padding: '4px 6px', fontSize: 12, whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}
                    title={`${r.judul} · ${r.poin} poin`}
                  >
                    {r.judul}
                  </td>
                  {Array.from({ length: TOTAL_WEEKS }, (_, w) => {
                    const inBar = w >= r.start && w <= r.end;
                    return (
                      <td
                        key={w}
                        style={{ ...cell, background: inBar ? r.warna : w === todayWeek ? 'rgba(0,0,0,0.045)' : undefined }}
                      >
                        {inBar && w === r.start && r.selesai ? (
                          <span style={{ color: '#fff', fontSize: 10, padding: '0 4px', whiteSpace: 'nowrap' }}>✓ Selesai</span>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ gap: 12, fontSize: 11, color: 'var(--ink-soft)', flexWrap: 'wrap', marginTop: 8 }}>
        <span><span style={{ color: COLOR.normal }}>■</span> Berjalan</span>
        <span><span style={{ color: COLOR.terlambat }}>■</span> Lewat deadline</span>
        <span><span style={{ color: COLOR.selesai }}>■</span> ✓ Selesai (approved)</span>
        <span>Kolom abu-abu = minggu ini · geser ke samping untuk semua bulan</span>
      </div>
    </div>
  );
}
