import { AuthProvider } from '@/components/AuthContext';
import SideNav from '@/components/SideNav';
import BottomNav from '@/components/BottomNav';
import './globals.css';

export const metadata = {
  title: 'Task Tracker — Production Engineering',
  description: 'Task tracker tim Production Engineering dengan poin & notifikasi Telegram.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <AuthProvider>
          <SideNav />
          {children}
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}
