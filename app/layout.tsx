import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DayBridge — Personal Daily Organizer',
  description: 'Private daily-life management and accountability organizer for schedule, medication, money, and tasks.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    title: 'DayBridge — Personal Daily Organizer',
    description: 'Private daily-life management and accountability organizer for schedule, medication, money, and tasks.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DayBridge — Personal Daily Organizer',
    description: 'Private daily-life management and accountability organizer for schedule, medication, money, and tasks.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0d9488',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-teal-500 selection:text-white" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
