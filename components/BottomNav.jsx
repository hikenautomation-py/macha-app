'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconHome, IconClipboardPlus, IconChartLine, IconTrophy, IconCalendarWeek,
} from '@tabler/icons-react';
import { useAuth } from '@/components/AuthContext';
import { isAtasan } from '@/lib/constants';
import { navItemsFor } from '@/lib/nav';

const ICONS = { IconHome, IconClipboardPlus, IconChartLine, IconTrophy, IconCalendarWeek };

// Bottom navbar mobile (< 900px). Tampil hanya saat login.
export default function BottomNav() {
  const { profile } = useAuth();
  const pathname = usePathname();
  if (!profile) return null;
  const items = navItemsFor(profile, { mobile: true, atasan: isAtasan(profile) }).slice(0, 5);

  return (
    <nav className="bottomnav" aria-label="Navigasi utama">
      {items.map((it) => {
        const Icon = ICONS[it.icon] || IconHome;
        const active = pathname === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`bottomnav-item${active ? ' active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={22} aria-hidden="true" />
            <span>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
