"use client";

import { ThemeToggle } from "../ThemeToggle";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from 'next/image';
import { Dice5, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SITE_FEATURES } from "@/config/features";
import { gameCategories } from "@/config/game-catalog";
import { SITE_ROUTES } from "@/config/routes";
import { SITE_CONFIG } from "@/config/site";
import {
  FAVORITE_GAMES_STORAGE_KEY,
  GAME_LIBRARY_CHANGED_EVENT,
  getFavoriteGames,
  getRecentGames,
  type LibraryGame,
  RECENT_GAMES_STORAGE_KEY,
  recordRecentGame,
} from "@/lib/game-library";
import {
  GameLibraryDrawer,
  type GameLibraryTab,
} from "./GameLibraryDrawer";

interface NavLink {
  text: string;
  href: string;
}

const NAV_LINKS: NavLink[] = SITE_CONFIG.navigation.links.map((link) => ({
  text: link.label,
  href: SITE_ROUTES[link.route],
}));

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [sitemapRoutes, setSitemapRoutes] = useState<string[]>([]);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [isGameLibraryOpen, setIsGameLibraryOpen] = useState(false);
  const [gameLibraryTab, setGameLibraryTab] = useState<GameLibraryTab>("favorites");
  const [favoriteGames, setFavoriteGames] = useState<LibraryGame[]>([]);
  const [recentGames, setRecentGames] = useState<LibraryGame[]>([]);

  const links = NAV_LINKS;

  const excludedPaths = useMemo(() => {
    return new Set<string>([
      SITE_ROUTES.home,
      SITE_ROUTES.hotGames,
      SITE_ROUTES.aboutUs,
      SITE_ROUTES.contactUs,
      SITE_ROUTES.dmca,
      SITE_ROUTES.terms,
      SITE_ROUTES.privacy,
    ]);
  }, []);

  const fallbackRoutes = useMemo(() => {
    const set = new Set<string>();

    gameCategories.forEach((category) => {
      set.add(category.path);
      category.games.forEach((g) => set.add(g.url));
    });

    return Array.from(set).filter((p) => !excludedPaths.has(p));
  }, [excludedPaths]);

  const allGames = useMemo(
    () => gameCategories.flatMap((category) => category.games),
    [],
  );

  const normalizePath = useCallback((p: string) => {
    const withLeadingSlash = p.startsWith("/") ? p : `/${p}`;
    if (withLeadingSlash === "/") return "/";
    return withLeadingSlash.replace(/\/+$/, "");
  }, []);

  const syncGameLibrary = useCallback(() => {
    setFavoriteGames(getFavoriteGames());
    setRecentGames(getRecentGames());
  }, []);

  const closeGameLibrary = useCallback(() => {
    setIsGameLibraryOpen(false);
  }, []);

  useEffect(() => {
    syncGameLibrary();

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === FAVORITE_GAMES_STORAGE_KEY ||
        event.key === RECENT_GAMES_STORAGE_KEY
      ) {
        syncGameLibrary();
      }
    };

    window.addEventListener(GAME_LIBRARY_CHANGED_EVENT, syncGameLibrary);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(GAME_LIBRARY_CHANGED_EVENT, syncGameLibrary);
      window.removeEventListener("storage", handleStorage);
    };
  }, [syncGameLibrary]);

  useEffect(() => {
    if (!SITE_FEATURES.gameLibrary || !pathname) return;
    const normalizedPath = normalizePath(pathname);
    const currentGame =
      normalizedPath === SITE_ROUTES.home
        ? allGames.find((game) => game.id === SITE_CONFIG.primaryGameId)
        : allGames.find((game) => normalizePath(game.url) === normalizedPath);

    if (!currentGame) return;
    recordRecentGame({
      id: currentGame.id,
      title: currentGame.title,
      image: currentGame.image,
      url: currentGame.url,
    });
  }, [allGames, normalizePath, pathname]);

  const isAllowedPath = useCallback(
    (p: string) => {
      const path = normalizePath(p);
      if (excludedPaths.has(path)) return false;
      if (!path.startsWith("/")) return false;
      if (path.endsWith(".xml") || path.endsWith(".txt")) return false;
      return true;
    },
    [excludedPaths, normalizePath],
  );

  const loadRoutesFromSitemap = useCallback(async () => {
    if (isLoadingRoutes || sitemapRoutes.length > 0) return sitemapRoutes;

    setIsLoadingRoutes(true);
    try {
      const res = await fetch("/sitemap.xml", { cache: "force-cache" });
      if (!res.ok) throw new Error("Failed to fetch sitemap");

      const xml = await res.text();
      const doc = new DOMParser().parseFromString(xml, "text/xml");
      const locEls = Array.from(doc.getElementsByTagName("loc"));

      const set = new Set<string>();
      locEls.forEach((el) => {
        const raw = el.textContent?.trim();
        if (!raw) return;

        let path = "";
        try {
          path = new URL(raw).pathname;
        } catch {
          path = raw;
        }

        const normalized = normalizePath(path);
        if (isAllowedPath(normalized)) set.add(normalized);
      });

      const list = Array.from(set);
      setSitemapRoutes(list);
      return list;
    } catch {
      return [];
    } finally {
      setIsLoadingRoutes(false);
    }
  }, [isAllowedPath, isLoadingRoutes, normalizePath, sitemapRoutes]);

  const handleRandomNavigate = async () => {
    const fromSitemap = sitemapRoutes.length > 0 ? sitemapRoutes : await loadRoutesFromSitemap();
    const pool = fromSitemap.length > 0 ? fromSitemap : fallbackRoutes;
    if (pool.length === 0) return;

    let next = pool[Math.floor(Math.random() * pool.length)];
    for (let i = 0; i < 5 && next === pathname && pool.length > 1; i++) {
      next = pool[Math.floor(Math.random() * pool.length)];
    }

    router.push(next);
  };

  const handleOpenGameLibrary = () => {
    syncGameLibrary();
    setGameLibraryTab("favorites");
    setIsGameLibraryOpen(true);
  };

  return (
    <>
    <nav className="bg-green-700 dark:bg-green-800 z-50">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="grid h-[45px] grid-cols-[minmax(0,1fr)_auto] items-center md:grid-cols-[1fr_auto_1fr]">
          <div className="flex min-w-0 items-center justify-start">
            <Link href={SITE_ROUTES.home} className="flex min-w-0 items-center gap-2">
              <Image
                src={SITE_CONFIG.assets.navigationLogo}
                alt={SITE_CONFIG.name}
                width={38}
                height={38}
                className="h-8 w-8 shrink-0 rounded-md object-cover ring-2 ring-white/80 shadow-[0_0_18px_rgba(255,255,255,0.45)] sm:h-[38px] sm:w-[38px] dark:ring-white/70 dark:shadow-[0_0_18px_rgba(34,197,94,0.35)]"
              />
              <span className="min-w-0 truncate whitespace-nowrap text-base font-bold text-white sm:text-xl md:text-2xl">
                {SITE_CONFIG.brandName}
              </span>
            </Link>
          </div>

          <div className="hidden md:flex items-center justify-center space-x-8">
            {links.map((link, index) => (
              <div
                key={index}
                className="relative group"
              >
                <Link
                  href={link.href}
                  className="text-white/90 relative px-2 py-1 group text-sm font-semibold transition-all duration-200
                    hover:text-white focus:outline-none rounded flex items-center"
                >
                  {link.text}
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-white transition-all duration-200 group-hover:w-full"></span>
                </Link>
              </div>
            ))}
          </div>

          <div className="ml-auto flex shrink-0 items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-green-500"
              onClick={handleRandomNavigate}
              aria-label="Random page"
            >
              <Dice5 className="h-5 w-5" />
            </Button>
            {SITE_FEATURES.gameLibrary && (
              <Button
                variant="ghost"
                size="icon"
                className="relative text-white hover:bg-green-500"
                onClick={handleOpenGameLibrary}
                aria-label="My games"
                title="My games"
              >
                <Heart
                  className={`h-5 w-5 ${
                    favoriteGames.length > 0 ? "fill-red-400 text-red-400" : ""
                  }`}
                />
                {favoriteGames.length > 0 && (
                  <span className="absolute right-0.5 top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-white px-0.5 text-[9px] font-bold leading-none text-red-600">
                    {favoriteGames.length > 9 ? "9+" : favoriteGames.length}
                  </span>
                )}
              </Button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
    {SITE_FEATURES.gameLibrary && (
      <GameLibraryDrawer
        isOpen={isGameLibraryOpen}
        activeTab={gameLibraryTab}
        favorites={favoriteGames}
        recents={recentGames}
        onClose={closeGameLibrary}
        onTabChange={setGameLibraryTab}
      />
    )}
    </>
  );
}
