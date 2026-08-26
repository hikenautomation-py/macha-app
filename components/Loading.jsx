'use client';

// Indikator pemuatan konsisten (spinner + teks).
export default function Loading({ label = 'Memuat…' }) {
  return (
    <p className="muted" role="status">
      <span className="spinner" aria-hidden="true" /> {label}
    </p>
  );
}