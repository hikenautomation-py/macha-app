'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { isAtasan } from '@/lib/constants';

// Halaman awal — arahkan berdasarkan status login & golongan.
export default function Home() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/login');
      return;
    }
    router.replace(isAtasan(profile) ? '/dashboard' : '/tech');
  }, [loading, session, profile, router]);

  return (
    <div className="container">
      <p className="muted">Memuat…</p>
    </div>
  );
}
