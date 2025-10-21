import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Sidebar from './components/Sidebar';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata = {
  title: 'Reviewdash',
  description: 'Store reviews dashboard',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-900 text-zinc-100`}
      >
        <div className="flex">
          {/* Sidebar ซ้าย (Server Component) */}
          <Sidebar />
          {/* เนื้อหา */}
          <div className="flex-1 min-h-screen p-6">{children}</div>
        </div>
      </body>
    </html>
  );
}
