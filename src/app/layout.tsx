import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Velo99 Bulksales — Malaysia Online Bicycle Wholesale Platform',
  description:
    'Order bicycles and spare parts in wholesale cartons across Peninsular Malaysia. Live CBM free delivery tracking, dealer tier discounts, 0% 3-month SME instalments, and self-editable Admin CMS.',
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
