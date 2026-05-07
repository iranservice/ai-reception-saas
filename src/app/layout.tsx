import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Reception SaaS',
  description:
    'Multi-tenant B2B AI receptionist platform for customer operations',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
