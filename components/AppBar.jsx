'use client';

// Header aplikasi: brand + deretan aksi kanan.
export default function AppBar({ actions }) {
  return (
    <div className="appbar">
      <div className="brand">
        <span aria-hidden="true">🔧</span> Macha Task
      </div>
      {actions ? <div className="row" style={{ gap: 8 }}>{actions}</div> : null}
    </div>
  );
}