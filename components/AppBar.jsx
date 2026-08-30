'use client';

import { IconTool } from '@tabler/icons-react';

// Header aplikasi: brand + deretan aksi kanan.
export default function AppBar({ actions }) {
  return (
    <div className="appbar">
      <div className="brand">
        <IconTool size={18} aria-hidden="true" /> Macha Task
      </div>
      {actions ? <div className="row" style={{ gap: 8 }}>{actions}</div> : null}
    </div>
  );
}