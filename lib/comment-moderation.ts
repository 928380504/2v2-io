import { SITE_RUNTIME } from "@/site/runtime";

const LINK_PATTERN = /(?:https?|ftp):\/\/|www\.|\b[^\s@]+@[^\s@]+\.[a-z]{2,63}\b|\b(?:\d{1,3}\.){3}\d{1,3}\b|\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|gg|lol|co|cc|me|dev|app|ai|xyz|info|tv|us|uk|cn|de|fr|ru|jp|in|top|link|shop|store|club|pro|tech|cloud|live|fun|space|site|online|website|games?|play)(?:\b|[/?#])/i;
const OBFUSCATED_LINK_PATTERN = /\b[a-z0-9-]+\s*(?:\[\s*dot\s*\]|\(\s*dot\s*\)|\s+dot\s+)\s*(?:com|net|org|io|gg|co|cc|dev|app|ai|xyz|site|online|games?)\b/i;
const DISALLOWED_LANGUAGE_PATTERNS = [
  /\b(?:f+u+c+k+(?:er|ing|ed)?|fck|motherfucker|asshole|bitch|bastard|dickhead|cunt)\b/i,
  /\b(?:idiot|moron|retard(?:ed)?|piece\s+of\s+shit)\b/i,
  /(?:傻\s*(?:逼|比|币|b)|脑残|去死|废物|狗东西|操你|草你|妈的)/i,
];

export function normalizeModerationText(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[@4]/g, "a")
    .replace(/[3]/g, "e")
    .replace(/[1!]/g, "i")
    .replace(/[0]/g, "o")
    .replace(/[$5]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/(?<=[a-z])[._*~-]+(?=[a-z])/g, "");
}

export function normalizeComparableComment(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function validateCommentText(author: string, content: string) {
  const combinedText = `${author} ${content}`;
  const linkCheckText = SITE_RUNTIME.moderation.allowedLinkLikeTerms.reduce(
    (text, term) => {
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return text.replace(new RegExp(`\\b${escapedTerm}\\b`, "gi"), "site game");
    },
    combinedText,
  );

  if (LINK_PATTERN.test(linkCheckText) || OBFUSCATED_LINK_PATTERN.test(linkCheckText)) {
    return "Links are not allowed in comments.";
  }

  const moderatedText = normalizeModerationText(combinedText);
  if (DISALLOWED_LANGUAGE_PATTERNS.some((pattern) => pattern.test(moderatedText))) {
    return "Please keep comments respectful and avoid offensive language.";
  }

  const latinLetters = content.match(/[a-z]/gi) || [];
  const uppercaseLetters = content.match(/[A-Z]/g) || [];
  if (
    latinLetters.length >= 15 &&
    uppercaseLetters.length / latinLetters.length >= 0.7
  ) {
    return "Please avoid excessive capital letters.";
  }

  if (
    /([\s\S])\1{4,}/i.test(content) ||
    /\b([a-z0-9]{2,})(?:\s+\1){3,}\b/i.test(content)
  ) {
    return "Please avoid repeated characters or words.";
  }

  return null;
}

