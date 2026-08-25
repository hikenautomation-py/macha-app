import { AuthProvider } from '@/components/AuthContext';
import './globals.css';

export const metadata = {
  title: 'Task Tracker — Production Engineering',
  description: 'Task tracker tim Production Engineering dengan poin & notifikasi Telegram.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
