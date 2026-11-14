import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'AIriane · Clinician workspace', description: 'Patient-authorized wellbeing reports', icons: { icon: '/brand/airiane-symbol.png' } };
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>) { return <html lang="en"><body>{children}</body></html>; }
