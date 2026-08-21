import type { Metadata } from "next";
import { SITE_CONFIG, siteUrl } from "@/site/site";

export const LEGAL_SITE = {
  name: SITE_CONFIG.brandName,
  url: SITE_CONFIG.url,
  email: SITE_CONFIG.email,
  lastUpdated: SITE_CONFIG.legalLastUpdated,
} as const;

export const LEGAL_PAGES = {
    "aboutUs": {
      "path": "/about-us",
      "navLabel": "About Us",
      "eyebrow": "Who we are",
      "title": "About 2v2-io.com",
      "metadataTitle": "About Us",
      "description": "A player-focused browser gaming site built for quick access and straightforward discovery.",
      "seoDescription": "Learn about 2v2-io.com and the browser game experience we are building."
    },
    "contactUs": {
      "path": "/contact-us",
      "navLabel": "Contact Us",
      "eyebrow": "Get in touch",
      "title": "Contact Us",
      "metadataTitle": "Contact Us",
      "description": "Tell us about a broken game, site issue, suggestion, privacy request, or rights-related concern.",
      "seoDescription": "Contact 2v2-io.com for support, feedback, privacy questions, or copyright matters."
    },
    "dmca": {
      "path": "/dmca",
      "navLabel": "DMCA",
      "eyebrow": "Copyright",
      "title": "DMCA and Copyright Policy",
      "metadataTitle": "DMCA and Copyright Policy",
      "description": "We respect intellectual property rights and review sufficiently detailed copyright notices concerning 2v2-io.com.",
      "seoDescription": "Learn how to report alleged copyright infringement to 2v2-io.com.",
      "showLastUpdated": true
    },
    "terms": {
      "path": "/terms-of-service",
      "navLabel": "Terms of Service",
      "eyebrow": "Legal",
      "title": "Terms of Service",
      "metadataTitle": "Terms of Service",
      "description": "These terms govern access to 2v2-io.com, its games, community features, and related services.",
      "seoDescription": "Read the terms governing access to 2v2-io.com.",
      "showLastUpdated": true
    },
    "privacy": {
      "path": "/privacy-policy",
      "navLabel": "Privacy Policy",
      "eyebrow": "Privacy",
      "title": "Privacy Policy",
      "metadataTitle": "Privacy Policy",
      "description": "This policy explains information processed when you visit 2v2-io.com, play games, or use community features.",
      "seoDescription": "Learn what information 2v2-io.com processes.",
      "showLastUpdated": true
    }
  } as const;
export const ABOUT_US_CONTENT = {
    "whyBuilt": {
      "title": "Why We Built This Site",
      "paragraphs": [
        "2v2.io helps players discover and start browser games without a lengthy installation process."
      ]
    },
    "catalog": {
      "title": "What You Can Find Here",
      "paragraphs": [
        "Browse games by popularity, freshness, and gameplay attributes.",
        "Games may be delivered from our infrastructure or embedded from third-party providers, and availability can change."
      ]
    },
    "profiles": {
      "title": "Player Profiles and Community Activity",
      "paragraphs": [
        "A mandatory account is not required unless a specific feature says otherwise.",
        "Local progress can be lost when browser data is cleared or a player changes device or browser."
      ],
      "privacyLinkLabel": "Privacy Policy"
    },
    "independence": {
      "title": "Independent Website",
      "paragraphs": [
        "2v2-io.com is an independent website. Third-party game names, artwork, logos, and trademarks belong to their respective owners."
      ]
    },
    "contact": {
      "title": "Contact",
      "lead": "For support, suggestions, privacy requests, or copyright concerns, visit our",
      "linkLabel": "Contact Us",
      "suffix": "page or email"
    }
  } as const;

export type LegalPageKey = keyof typeof LEGAL_PAGES;
export function createLegalMetadata(pageKey: LegalPageKey): Metadata {
  const page = LEGAL_PAGES[pageKey];
  return { title: `${page.metadataTitle} - ${LEGAL_SITE.name}`, description: page.seoDescription, alternates: { canonical: siteUrl(page.path) } };
}
