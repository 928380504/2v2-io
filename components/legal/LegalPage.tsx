import Link from "next/link";
import type { ReactNode } from "react";
import {
  LEGAL_PAGES,
  LEGAL_SITE,
  type LegalPageKey,
} from "@/config/legal-pages";

interface LegalPageProps {
  pageKey: LegalPageKey;
  children: ReactNode;
}

export function LegalPage({ pageKey, children }: LegalPageProps) {
  const page = LEGAL_PAGES[pageKey];

  return (
    <div className="site-container-width mx-auto px-4 py-10 sm:py-14">
      <header className="rounded-2xl border border-green-200 bg-white/90 p-6 shadow-sm dark:border-green-700/60 dark:bg-[#0d4021] sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-green-700 dark:text-green-300">
          {page.eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950 dark:text-white sm:text-4xl">
          {page.title}
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-600 dark:text-gray-300 sm:text-base">
          {page.description}
        </p>
        {"showLastUpdated" in page && page.showLastUpdated && (
          <p className="mt-4 text-xs font-semibold text-gray-500 dark:text-gray-400">
            Last updated: {LEGAL_SITE.lastUpdated}
          </p>
        )}
      </header>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_230px]">
        <article className="space-y-7 rounded-2xl border border-green-100 bg-white p-6 text-sm leading-7 text-gray-700 shadow-sm dark:border-green-700/50 dark:bg-green-950/40 dark:text-gray-200 sm:p-8 sm:text-base">
          {children}
        </article>

        <nav
          aria-label="Information pages"
          className="rounded-2xl border border-green-100 bg-white p-4 shadow-sm dark:border-green-700/50 dark:bg-green-950/40 lg:sticky lg:top-6"
        >
          <p className="px-3 pb-2 text-[11px] font-black uppercase tracking-[0.18em] text-green-700 dark:text-green-300">
            Information
          </p>
          <ul className="space-y-1">
            {Object.values(LEGAL_PAGES).map((navigationPage) => (
              <li key={navigationPage.path}>
                <Link
                  href={navigationPage.path}
                  className="block rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-green-50 hover:text-green-800 dark:text-gray-200 dark:hover:bg-green-800/60 dark:hover:text-white"
                >
                  {navigationPage.navLabel}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-black text-gray-950 dark:text-white sm:text-2xl">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function LegalContactEmail({ subject }: { subject?: string }) {
  const href = subject
    ? `mailto:${LEGAL_SITE.email}?subject=${encodeURIComponent(subject)}`
    : `mailto:${LEGAL_SITE.email}`;

  return (
    <a
      href={href}
      className="font-bold text-green-700 underline decoration-green-300 underline-offset-4 hover:text-green-800 dark:text-green-300 dark:hover:text-green-200"
    >
      {LEGAL_SITE.email}
    </a>
  );
}
