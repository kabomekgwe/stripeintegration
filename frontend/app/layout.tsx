import { Geist, Geist_Mono, Inter } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { StoreProvider } from '@/components/StoreProvider';
import { ToastProvider } from '@/components/providers/toast-provider';
import { SessionExpiredHandler } from '@/components/auth';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

const fontMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

/**
 * Root Layout - Server Component
 *
 * This is a Server Component that wraps the application.
 * Client-side providers (Redux) are loaded via StoreProvider.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn('antialiased', fontMono.variable, 'font-sans', inter.variable)}
    >
      <body>
        <StoreProvider>
          <ThemeProvider>
            <ToastProvider />
            <Suspense fallback={null}>
              <SessionExpiredHandler />
            </Suspense>
            {children}
          </ThemeProvider>
        </StoreProvider>
      </body>
    </html>
  );
}