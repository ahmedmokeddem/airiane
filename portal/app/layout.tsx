import type { Metadata } from 'next';
import './globals.css';
import './premium.css';
export const metadata: Metadata = { title: {default:'AIriane',template:'%s · AIriane'}, description: 'Patient-authorized wellbeing reports', icons: { icon: '/brand/airiane-symbol.png' } };
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>) { return <html lang="en"><body>{children}</body></html>; }
