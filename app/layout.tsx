import './globals.css';
import type { Metadata } from 'next';
import { ThemeProvider } from "@/components/ThemeProvider";
import {
  SiteActivityFeed,
  SiteFeedbackWidget,
  SiteFooter,
  SiteNavbar,
} from "@/components/slots";
import { SITE_FEATURES } from "@/config/features";
import { SITE_CONFIG, siteUrl } from "@/config/site";
import { SITE_THEME, SITE_THEME_STYLE } from "@/config/theme";

import { AnalyticsHead } from "@/components/analytics-head"
import { AdsHead } from "@/components/ads-head"
// 删除 Inter 字体配置代码块

export const metadata: Metadata = {
  metadataBase: new URL(SITE_CONFIG.url),
  title: SITE_CONFIG.seo.title,
  description: SITE_CONFIG.seo.description,
  authors: [{ name: SITE_CONFIG.name }],
  creator: SITE_CONFIG.name,
  publisher: SITE_CONFIG.name,
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    title: SITE_CONFIG.seo.title,
    description: SITE_CONFIG.seo.description,
    url: SITE_CONFIG.url,
    siteName: SITE_CONFIG.name,
    images: [{
      url: siteUrl(SITE_CONFIG.assets.logo),
      width: 100,
      height: 100,
      alt: SITE_CONFIG.seo.title,
      type: 'image/webp'
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_CONFIG.seo.title,
    description: SITE_CONFIG.seo.description,
    images: [{
      url: siteUrl(SITE_CONFIG.assets.logo),
      width: 100,
      height: 100,
      alt: SITE_CONFIG.seo.title,
      type: 'image/webp'
    }],
    creator: SITE_CONFIG.seo.twitterCreator,
    site: SITE_CONFIG.seo.twitterCreator
  },
  alternates: {
    canonical: SITE_CONFIG.url
  },
  icons: {
    icon: SITE_CONFIG.assets.favicon,
  },
  // 删除 verification 配置
  keywords: [...SITE_CONFIG.seo.keywords],
  applicationName: SITE_CONFIG.name,
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
    <html lang={SITE_CONFIG.language} suppressHydrationWarning>
      <head>
      
      
      
        {SITE_FEATURES.analytics && <AnalyticsHead />}
        {SITE_FEATURES.advertising && <AdsHead />}
      </head>
      <body>  {/* 移除 inter.className */}
     

        <ThemeProvider
          attribute="class"
          defaultTheme={SITE_THEME.defaultMode}
          enableSystem={false}
          disableTransitionOnChange
        >
          <div
            className="site-shell flex min-h-screen flex-col"
            style={SITE_THEME_STYLE}
          >
            <SiteNavbar />
            {SITE_FEATURES.activityFeed && <SiteActivityFeed />}
            <main className="flex-grow">
              {children}
            </main>
            <SiteFooter />
          </div>
          {SITE_FEATURES.feedback && <SiteFeedbackWidget />}
        </ThemeProvider>
      </body>
    </html>
  );
}
