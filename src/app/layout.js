import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import JobProvider from '@/components/JobContext';
import AppShell from '@/components/AppShell';

export const metadata = {
  title: 'NEXUS OPERATIONS | Enterprise Management',
  description: 'Production-grade multi-tenant operations platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <JobProvider>
            <AppShell>{children}</AppShell>
          </JobProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
