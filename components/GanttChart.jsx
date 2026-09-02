'use client';

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Cell,
} from 'recharts';

const DAY_MS = 86400000;
const WINDOW_DAYS = 28; // 4 minggu

function startOfWeek(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = (date.getDay() + 6) % 7; // Senin = 0
  date.setDate(date.getDate() - day);
  return date;
}

function diffDays(from, to) {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

// Warna bar per kondisi task (palet CSS var tidak bisa dipakai di SVG recharts
// secara andal saat SSR, jadi pakai hex yang sama dengan token desain).
const COLOR = {
  terlambat: '#e2604f', // coral — lewat deadline
  segera: '#e2a13c', // amber — deadline <= 3 hari
  normal: '#2f8f83', // teal
};

function GanttTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="card" style={{ padding: '8px 12px', fontSize: 12, maxWidth: 240 }}>
      <div style={{ fontWeight: 600 }}>{row.judul}</div>
      <div style={{ color: 'var(--ink-soft)' }}>{row.pelaksana}</div>
      <div>
        {row.mulai || '—'} → {row.deadline || 'tanpa deadline'}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)' }}>{row.durasi} hari · {row.poin} poin</div>
      {row.kondisi === 'terlambat' ? <div style={{ color: COLOR.terlambat }}>Lewat deadline</div> : null}
      {row.kondisi === 'segera' ? <div style={{ color: COLOR.segera }}>Deadline segera (≤3 hari)</div> : null}
    </div>
  );
}

/**
 * Gantt chart 4 minggu berbasis recharts (stacked horizontal bar:
 * bar "offset" transparan + bar "durasi" berwarna).
 * agenda: hasil GET /api/schedule (butuh field mulai, deadline, judul, pelaksana).
 * multiUser: true untuk atasan (label baris menyertakan nama pelaksana).
 */
export default function GanttChart({ agenda, multiUser }) {
  const windowStart = startOfWeek(new Date());
  const windowEnd = new Date(windowStart.getTime() + WINDOW_DAYS * DAY_MS);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayOffset = diffDays(windowStart, today);

  const rows = (agenda || [])
    .filter((t) => t.deadline) // tanpa deadline tidak bisa digambar di timeline
    .map((t) => {
      const start = t.mulai ? new Date(`${t.mulai}T00:00:00`) : today;
      const end = new Date(`${t.deadline}T00:00:00`);
      // Clamp ke jendela 4 minggu.
      const rawStart = Math.max(0, diffDays(windowStart, start));
      const rawEnd = Math.min(WINDOW_DAYS, diffDays(windowStart, end) + 1);
      if (rawEnd <= 0 || rawStart >= WINDOW_DAYS) return null; // di luar jendela
      const sisaHari = diffDays(today, end);
      const kondisi = t.terlambat ? 'terlambat' : sisaHari <= 3 ? 'segera' : 'normal';
      return {
        label: multiUser ? `${t.pelaksana} — ${t.judul}` : t.judul,
        judul: t.judul,
        pelaksana: t.pelaksana,
        mulai: t.mulai,
        deadline: t.deadline,
        poin: t.poin,
        offset: rawStart,
        durasi: Math.max(1, rawEnd - rawStart),
        kondisi,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (multiUser ? a.pelaksana.localeCompare(b.pelaksana) || a.offset - b.offset : a.offset - b.offset));

  if (rows.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Tidak ada task ber-deadline dalam jendela 4 minggu ini.</p>;
  }

  const height = Math.max(160, rows.length * 34 + 60);
  const weekTicks = [0, 7, 14, 21, 28];
  const tickLabel = (v) => (v >= WINDOW_DAYS ? '' : `W${Math.floor(v / 7) + 1}`);

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 8 }} barCategoryGap={6}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis
            type="number"
            domain={[0, WINDOW_DAYS]}
            ticks={weekTicks}
            tickFormatter={tickLabel}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={multiUser ? 170 : 120}
            tick={{ fontSize: 11 }}
          />
          <Tooltip content={<GanttTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          {todayOffset >= 0 && todayOffset <= WINDOW_DAYS ? (
            <ReferenceLine x={todayOffset} stroke="#5b6472" strokeDasharray="4 4" label={{ value: 'Hari ini', position: 'top', fontSize: 10 }} />
          ) : null}
          <Bar dataKey="offset" stackId="g" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="durasi" stackId="g" radius={[4, 4, 4, 4]} isAnimationActive={false}>
            {rows.map((r, i) => (
              <Cell key={i} fill={COLOR[r.kondisi]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="row" style={{ gap: 12, fontSize: 11, color: 'var(--ink-soft)', flexWrap: 'wrap' }}>
        <span><span style={{ color: COLOR.normal }}>■</span> Berjalan</span>
        <span><span style={{ color: COLOR.segera }}>■</span> Deadline ≤3 hari</span>
        <span><span style={{ color: COLOR.terlambat }}>■</span> Lewat deadline</span>
      </div>
    </div>
  );
}
