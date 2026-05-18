import './globals.css';
import type { Metadata } from 'next';
import { ThemeProvider } from "@/components/ThemeProvider";
import Navbar from "@/components/All/Navbar";
import { Footer } from "@/components/All/Footer";
import Script from 'next/script';

export const metadata: Metadata = {
  metadataBase: new URL('https://2v2-io.com'),
  title: '2v2.io - Play Online for Free!',
  description: '2v2.io is a fast-paced battle royale game that fuses sharp shooting with instant building, where you and your teammate fight to be the last squad standing in a shrinking arena.​',
  authors: [{ name: '2v2.io' }],
  creator: '2v2.io',
  publisher: '2v2.io',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    title: '2v2.io - Play Online for Free!',
    description: '2v2.io is a fast-paced battle royale game that fuses sharp shooting with instant building, where you and your teammate fight to be the last squad standing in a shrinking arena.​​',
    url: 'https://2v2-io.com',
    siteName: '2v2.io',
    images: [{
      url: 'https://2v2-io.com/2v2-io-logo.webp',
      alt: '2v2.io - Play Online for Free!',
      type: 'image/webp'
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '2v2.io - Play Online for Free!',
    description: '2v2.io is a fast-paced battle royale game that fuses sharp shooting with instant building, where you and your teammate fight to be the last squad standing in a shrinking arena.​​',
    images: [{
      url: 'https://2v2-io.com/2v2-io-logo.webp',
      alt: '2v2.io - Play Online for Free!',
      type: 'image/webp'
    }],
    creator: '@PlanetClicker',
    site: '@PlanetClicker'
  },
  // 添加传统的 meta 标签
  other: {
    'image_src': 'https://2v2-io.com/2v2-io-logo.webp'
  },
  alternates: {
    canonical: 'https://2v2-io.com'
  },
  icons: {
    icon: '/favicon.ico',
  },
  keywords: ['2v2.io',],
  applicationName: '2v2.io',
  formatDetection: {
    telephone: false
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
    
      </head>
      <body className="font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex flex-col min-h-screen bg-green-50 dark:bg-green-900">
            <Navbar />
            <main className="flex-grow">
              {children}
            </main>
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
