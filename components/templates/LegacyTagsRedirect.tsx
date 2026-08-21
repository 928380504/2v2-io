"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { GameFiltersPageDefinition } from "@/config/game-filters-page";

export function LegacyTagsRedirect({
  page,
}: {
  page: GameFiltersPageDefinition;
}) {
  useEffect(() => {
    window.location.replace(
      `${page.path}${window.location.search}${window.location.hash}`,
    );
  }, [page.path]);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="rounded-2xl bg-white px-8 py-10 text-center shadow-sm ring-1 ring-green-100 dark:bg-[#0d4021] dark:ring-green-700/40">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {page.legacyMessage}
        </p>
        <Link
          href={page.path}
          className="mt-3 inline-flex rounded-full bg-green-700 px-4 py-2 text-sm font-bold text-white hover:bg-green-800 dark:bg-green-400 dark:text-green-950"
        >
          {page.legacyLinkLabel}
        </Link>
      </div>
    </main>
  );
}
