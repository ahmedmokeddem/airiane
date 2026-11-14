import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'RE · Clinician workspace', description: 'Patient-authorized wellbeing reports' };
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>) { return <html lang="en"><body>{children}</body></html>; }
