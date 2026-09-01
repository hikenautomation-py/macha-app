'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconHome, IconClipboardPlus, IconChartLine, IconTrophy,
  IconCalendarWeek, IconTrendingUp, IconUsersGroup,
} from '@tabler/icons-react';
import { useAuth } from '@/components/AuthContext';
import { isAtasan } from '@/lib/constants';
import { navItemsFor } from '@/lib/nav';

const ICONS = {
  IconHome, IconClipboardPlus, IconChartLine, IconTrophy,
  IconCalendarWeek, IconTrendingUp, IconUsersGroup,
};

// Sidebar desktop (>= 900px). Tampil hanya saat login.
export default function SideNav() {
  const { profile } = useAuth();
  const pathname = usePathname();
  if (!profile) return null;
  const items = navItemsFor(profile, { atasan: isAtasan(profile) });

  return (
    <nav className="sidenav" aria-label="Navigasi utama">
      {items.map((it) => {
        const Icon = ICONS[it.icon] || IconHome;
        const active = pathname === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`sidenav-item${active ? ' active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
