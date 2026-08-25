'use client';

import { TASK_STATUS_LABEL } from '@/lib/constants';

const STATUS_CLASS = {
  assigned: 'b-assigned',
  in_progress: 'b-progress',
  report_submitted: 'b-wait',
  approved: 'b-done',
  rejected: 'b-danger',
};

// Kartu task bergaya tiket dengan "stub poin" (elemen khas aplikasi).
export default function TicketCard({ task, onClick, children }) {
  const danger = task.status === 'rejected';
  return (
    <div className="ticket" onClick={onClick} role={onClick ? 'button' : undefined}>
      <div className="t-main">
        <div className="t-title">{task.judul}</div>
        {task.deadline ? <div className="t-meta">Deadline: {task.deadline}</div> : null}
        {task.deskripsi ? <div className="t-meta">{task.deskripsi}</div> : null}
        <span className={`badge ${STATUS_CLASS[task.status] || 'b-assigned'}`}>
          {TASK_STATUS_LABEL[task.status] || task.status}
        </span>
        {children}
      </div>
      <div className={`t-stub ${danger ? 'danger' : ''}`}>
        <span className="t-poin">{task.bobotPoin ?? 0}</span>
        <span className="t-poin-label">poin</span>
      </div>
    </div>
  );
}
