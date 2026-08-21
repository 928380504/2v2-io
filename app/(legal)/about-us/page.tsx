import Link from "next/link";
import {
  LegalContactEmail,
  LegalPage,
  LegalSection,
} from "@/components/legal/LegalPage";
import { ABOUT_US_CONTENT, createLegalMetadata } from "@/config/legal-pages";
import { SITE_ROUTES } from "@/config/routes";

export const metadata = createLegalMetadata("aboutUs");

export default function AboutUsPage() {
  return (
    <LegalPage pageKey="aboutUs">
      <LegalSection title={ABOUT_US_CONTENT.whyBuilt.title}>
        {ABOUT_US_CONTENT.whyBuilt.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </LegalSection>

      <LegalSection title={ABOUT_US_CONTENT.catalog.title}>
        {ABOUT_US_CONTENT.catalog.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </LegalSection>

      <LegalSection title={ABOUT_US_CONTENT.profiles.title}>
        <p>{ABOUT_US_CONTENT.profiles.paragraphs[0]}</p>
        <p>
          {ABOUT_US_CONTENT.profiles.paragraphs[1]} More details are available in our{" "}
          <Link
            href={SITE_ROUTES.privacy}
            className="font-bold text-green-700 underline underline-offset-4 dark:text-green-300"
          >
            {ABOUT_US_CONTENT.profiles.privacyLinkLabel}
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title={ABOUT_US_CONTENT.independence.title}>
        {ABOUT_US_CONTENT.independence.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </LegalSection>

      <LegalSection title={ABOUT_US_CONTENT.contact.title}>
        <p>
          {ABOUT_US_CONTENT.contact.lead}{" "}
          <Link
            href={SITE_ROUTES.contactUs}
            className="font-bold text-green-700 underline underline-offset-4 dark:text-green-300"
          >
            {ABOUT_US_CONTENT.contact.linkLabel}
          </Link>{" "}
          {ABOUT_US_CONTENT.contact.suffix} <LegalContactEmail />.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
