'use client';

// Skeleton loading — placeholder shimmer yang menyerupai layout konten
// (lihat .skeleton di globals.css). Semua variasi diakses dari satu file
// agar konsisten antar halaman.

export function SkeletonBlock({ width = '100%', height = 14, style }) {
  return <span className="skeleton" aria-hidden="true" style={{ display: 'block', width, height, ...style }} />;
}

// Daftar kartu (agenda, task list, antrean approval, ranking).
export function SkeletonList({ rows = 3, cardHeight = 64 }) {
  return (
    <div role="status" aria-label="Memuat…">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="card" style={{ padding: '12px 16px', marginBottom: 8 }}>
          <SkeletonBlock width="55%" height={14} style={{ marginBottom: 8 }} />
          <SkeletonBlock width="35%" height={11} />
          {cardHeight > 64 ? <SkeletonBlock width="70%" height={11} style={{ marginTop: 8 }} /> : null}
        </div>
      ))}
    </div>
  );
}

// Tabel (beban tim, statistik, gantt).
export function SkeletonTable({ rows = 4, cols = 4 }) {
  return (
    <div role="status" aria-label="Memuat…" className="card" style={{ padding: 16, marginBottom: 16 }}>
      <SkeletonBlock width="40%" height={14} style={{ marginBottom: 12 }} />
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="row" style={{ gap: 8, marginBottom: 8 }}>
          {Array.from({ length: cols }, (_, c) => (
            <SkeletonBlock key={c} width={c === 0 ? '30%' : `${Math.floor(60 / cols)}%`} height={12} />
          ))}
        </div>
      ))}
    </div>
  );
}

// Area chart / grafik besar.
export function SkeletonChart({ height = 220 }) {
  return (
    <div role="status" aria-label="Memuat…" className="card" style={{ padding: 16, marginBottom: 16 }}>
      <SkeletonBlock width="35%" height={14} style={{ marginBottom: 12 }} />
      <SkeletonBlock width="100%" height={height} />
    </div>
  );
}

// Form / kartu detail (halaman lapor selesai & lapor masalah).
export function SkeletonForm() {
  return (
    <div role="status" aria-label="Memuat…">
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <SkeletonBlock width="50%" height={16} style={{ marginBottom: 8 }} />
        <SkeletonBlock width="30%" height={12} />
      </div>
      <SkeletonBlock width="100%" height={96} style={{ marginBottom: 12 }} />
      <SkeletonBlock width="40%" height={40} />
    </div>
  );
}
