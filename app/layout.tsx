import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import './globals.css';

const WalletProvider = dynamic(
  () => import('./components/WalletProvider'),
  { ssr: false }
);

export const metadata: Metadata = {
  title: 'Delegate Activity Dashboard',
  description: 'Track delegation activity, voting power, and governance participation for DAO delegates',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
