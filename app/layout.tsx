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
        {/* Microsoft Clarity - 立即加载 */}
        <Script id="clarity" strategy="beforeInteractive">
          {`(function(c,l,a,r,i,t,y){
  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "vfkzxviunm");`}
        </Script>

        {/* Google Analytics - 立即加载 */}
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-WB6RMTYRVW"
          strategy="beforeInteractive"
        />
        <Script id="gtag" strategy="beforeInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-WB6RMTYRVW');`}
        </Script>

        {/* plausible统计 - 立即加载 */}
        <Script
          defer
          data-domain="2v2-io.com"
          src="https://plausible.jiang-shuai.com/js/script.js"
          strategy="afterInteractive"
        />
        {/* adsterra广告代码 - 立即加载 */}
        <Script
          async
          src="https://pl28854173.effectivegatecpm.com/5f/d7/2f/5fd72f174cf4f96c0b4b444ef98f2f35.js"
          strategy="afterInteractive"
        />
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
