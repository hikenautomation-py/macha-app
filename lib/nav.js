// Single source untuk item navigasi SideNav (desktop) & BottomNav (mobile).
// Ikon: nama komponen Tabler (di-resolve di komponen nav, bukan di sini,
// agar file ini bebas dipakai server-side).

// atasanOnly: hanya tampil untuk isAtasan(profile).
export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: 'IconHome', atasanOnly: true },
  { href: '/tech', label: 'Home', icon: 'IconHome', pelaksanaOnly: true },
  { href: '/tasks/new', label: 'Task baru', icon: 'IconClipboardPlus', atasanOnly: true },
  { href: '/performance', label: 'Performa', icon: 'IconChartLine' },
  { href: '/leaderboard', label: 'Ranking', icon: 'IconTrophy' },
  { href: '/schedule', label: 'Jadwal', icon: 'IconCalendarWeek' },
  { href: '/forecast', label: 'Forecast', icon: 'IconTrendingUp', desktopOnly: true },
  { href: '/teams', label: 'Tim', icon: 'IconUsersGroup', atasanOnly: true, desktopOnly: true },
];

// Filter item nav sesuai profil & platform.
export function navItemsFor(profile, { mobile = false, atasan = false } = {}) {
  return NAV_ITEMS.filter((it) => {
    if (it.atasanOnly && !atasan) return false;
    if (it.pelaksanaOnly && atasan) return false;
    if (mobile && it.desktopOnly) return false;
    return true;
  });
}
