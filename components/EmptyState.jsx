'use client';

// State kosong yang informatif, dengan role="status" supaya dibacakan pembaca layar.
export default function EmptyState({ children }) {
  return <div className="empty-state" role="status">{children}</div>;
}