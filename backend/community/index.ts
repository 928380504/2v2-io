import * as comments from "./comments/index";
import * as commentRatings from "./comments/ratings";
import * as commentReaction from "./comments/reaction";
import * as gameCards from "./games/cards";
import * as gameEngagement from "./games/engagement";

export const communityModule = {
  id: "community",
  migrationGroup: "community",
  handlers: {
    comments,
    commentRatings,
    commentReaction,
    gameCards,
    gameEngagement
  }
} as const;
