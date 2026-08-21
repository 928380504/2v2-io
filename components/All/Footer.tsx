import Link from 'next/link';
import { gameCategories } from "@/config/game-catalog";
import { SITE_ROUTES } from "@/config/routes";
import { SITE_CONFIG } from "@/config/site";

// 定义社交媒体链接数组
export function Footer() {
  const gamesById = new Map(
    gameCategories.flatMap((category) => category.games).map((game) => [game.id, game]),
  );
  const footerGames = SITE_CONFIG.footer.gameIds.flatMap((gameId) => {
    const game = gamesById.get(gameId);
    return game ? [game] : [];
  });

  return (
    <footer className="bg-green-700 dark:bg-green-800">
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 justify-items-center gap-5 text-center sm:grid-cols-3 md:gap-8">
          {/* 页脚链接 */}
          <div className="mx-auto w-fit max-w-full text-left">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Games</h3>
            <ul className="space-y-1">
              {footerGames.map((game) => (
                <li key={game.id}>
                  <Link href={game.url} className="inline-flex rounded py-1 text-sm text-white/90 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50">
                    {game.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="mx-auto w-fit max-w-full text-left">
            <h3 className="text-sm font-semibold text-green-100 uppercase tracking-wider mb-2">Company</h3>
            <ul className="space-y-1">
              <li>
                <Link href={SITE_ROUTES.aboutUs} className="text-sm text-green-100 hover:text-white">
                  About Us
                </Link>
              </li>
              <li>
                <Link href={SITE_ROUTES.contactUs} className="text-sm text-green-100 hover:text-white">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          <div className="mx-auto w-fit max-w-full text-left">
            <h3 className="text-sm font-semibold text-green-100 uppercase tracking-wider mb-2">Legal</h3>
            <ul className="space-y-1">
              <li>
                <Link href={SITE_ROUTES.terms} className="text-sm text-green-100 hover:text-white">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href={SITE_ROUTES.privacy} className="text-sm text-green-100 hover:text-white">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href={SITE_ROUTES.dmca} className="text-sm text-green-100 hover:text-white">
                  DMCA
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-5 border-t border-white/20 pt-4">
          <p className="text-center text-xs leading-5 text-white/90">
            <strong className="font-semibold text-white">Disclaimer:</strong>{' '}
            <Link
              href={SITE_CONFIG.url}
              className="font-semibold text-white underline decoration-white/60 underline-offset-2 transition-colors hover:decoration-white"
            >
              {SITE_CONFIG.brandName}
            </Link>{' '}
            is an independent website and is not affiliated with any organizations.
          </p>
        </div>
      </div>
    </footer>
  );
}
