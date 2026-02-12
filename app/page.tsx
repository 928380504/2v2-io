"use client";

import { STYLES } from "@/styles/constants";
import { ContentSection } from "@/components/ContentSection";
import { VideoPlayer } from "@/components/sj/VideoPlayer";
import { Creators } from "@/components/sj/Creators";
import { Reviews } from "@/components/sj/Reviews";
import { Title } from "@/components/TxT/what";
import { GameSection } from "@/components/YouXi/Game-IF";
import { HowToPlay } from "@/components/TxT/how";
import { Features } from "@/components/TxT/why";
import { Faq } from "@/components/TxT/Faq";
import { RelatedGames } from "@/components/YouXi/Games-Related";
import { GameIntro } from "@/components/TxT/Intro";

export default function Home() {
  return (
    <>
      {/* 额外的 Schema.org microdata 格式 */}
      <div style={{ position: 'absolute', left: '-9999px' }} itemScope itemType="http://schema.org/Game">
        <span itemProp="name">2v2.io</span>
        <div itemProp="aggregateRating" itemScope itemType="http://schema.org/AggregateRating">
          <span itemProp="ratingValue">4.9</span>
          <span itemProp="bestRating">5</span>
          <span itemProp="worstRating">1</span>
          <span itemProp="ratingCount">1658</span>
        </div>
      </div>

      <ContentSection 
        id="game" 
        className="px-2 py-2" 
        style={STYLES.container}
      >
        <div className="max-w-[980px] mx-auto">
          <div className="flex flex-col xl:flex-row gap-4">
            <div className="w-full xl:flex-1">
              <GameSection 
                gameUrl="https://game.1v1-lol.cc/1v1-lol-games/2v2-io/2v2-io.html"
                height="500px"
                className="w-full"
              />
            </div>
           
          </div>
        </div>
      </ContentSection>

      <div className="h-24"></div>

      <ContentSection className="px-4" style={STYLES.container}>
        <div className="max-w-[1200px] mx-auto space-y-24">
          <Title />
          <GameIntro />
          <Features />
          <HowToPlay />
          <div id="youtube" className="w-full max-w-4xl mx-auto">
            <VideoPlayer 
              videoId="0sIH1sUAQ0o"
              title="2v2.io"
              description="Watch and learn the best strategies to maximize your space exploration!"
              className="w-full"
            />
          </div>
          <Reviews />
          <Faq />
        </div>
      </ContentSection>
    </>
  );
}
