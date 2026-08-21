import { createHotGamesMetadata } from "@/config/hot-games-page";

export const metadata = createHotGamesMetadata();

export default function HotGamesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
