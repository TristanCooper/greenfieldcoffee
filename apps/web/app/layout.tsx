import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Greenfield Coffee';

export const metadata: Metadata = {
  title: { default: appName, template: `%s · ${appName}` },
  description:
    'Operations toolkit for UK and EU small-to-medium coffee roasteries, with EUDR traceability built in.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}