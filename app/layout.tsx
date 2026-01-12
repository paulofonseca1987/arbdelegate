import type { Metadata } from 'next';
import './globals.css';
import WalletProvider from './components/WalletProvider';

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
