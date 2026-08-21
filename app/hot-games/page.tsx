import { HotGamesPageTemplate } from "@/components/templates/HotGamesPageTemplate";

export const dynamic = "force-static";
export const revalidate = false;

export default function HotGamesPage() {
  return <HotGamesPageTemplate />;
}
