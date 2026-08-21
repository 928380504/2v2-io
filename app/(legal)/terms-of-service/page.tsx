import Link from "next/link";
import { LegalContactEmail, LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { createLegalMetadata, LEGAL_SITE } from "@/config/legal-pages";
import { SITE_ROUTES } from "@/config/routes";

export const metadata = createLegalMetadata("terms");

export default function TermsOfServicePage() {
  return (
    <LegalPage pageKey="terms">
      <LegalSection title="1. Acceptance and Eligibility">
        <p>By accessing or using {LEGAL_SITE.name}, you agree to these Terms of Service and our <Link href={SITE_ROUTES.privacy} className="font-bold text-green-700 underline underline-offset-4 dark:text-green-300">Privacy Policy</Link>. If you do not agree, do not use the service.</p>
        <p>The service is intended for users aged 13 or older. A parent or guardian is responsible for a minor&apos;s use where required by applicable law.</p>
      </LegalSection>

      <LegalSection title="2. Personal Use License">
        <p>We grant you a limited, revocable, non-exclusive, non-transferable license to access the site for lawful, personal, non-commercial entertainment. This license does not transfer ownership of any site or game content.</p>
      </LegalSection>

      <LegalSection title="3. Acceptable Use">
        <p>You must not:</p>
        <ul className="list-disc space-y-2 pl-5 marker:text-green-600">
          <li>Use the service for unlawful, fraudulent, or harmful activity.</li>
          <li>Attempt to bypass authentication, rate limits, access controls, or technical protections.</li>
          <li>Disrupt games, servers, matchmaking, rankings, or other users&apos; access.</li>
          <li>Submit fabricated match records, manipulate rankings, impersonate another player, or use abusive nicknames.</li>
          <li>Introduce malware, scrape the service at harmful volume, or probe systems without authorization.</li>
          <li>Harass, threaten, exploit, or violate the rights of another person.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Profiles, Rankings, and Public Activity">
        <p>The service may create a guest profile stored in your browser. Nicknames, country codes, match results, rankings, streaks, and achievements may appear publicly in leaderboards or activity feeds. You are responsible for the nickname you choose and must not include sensitive personal information.</p>
        <p>We may correct, exclude, or remove records that appear duplicated, automated, manipulated, abusive, or technically invalid. Rankings and local progress are provided as entertainment features and are not guaranteed to be permanent.</p>
      </LegalSection>

      <LegalSection title="5. Third-Party Games and Services">
        <p>Some games, multiplayer systems, analytics tools, advertisements, feedback tools, or links are provided by third parties. Their availability and data practices are governed by their own terms. We do not control and cannot guarantee third-party content, uptime, compatibility, or security.</p>
      </LegalSection>

      <LegalSection title="6. Intellectual Property">
        <p>The site&apos;s original layout, text, code, and branding are protected by applicable intellectual-property laws. Third-party game names, artwork, logos, software, and trademarks remain the property of their respective owners. {LEGAL_SITE.name} is an independent website and does not claim ownership of third-party trademarks.</p>
        <p>Copyright concerns should be submitted under our <Link href={SITE_ROUTES.dmca} className="font-bold text-green-700 underline underline-offset-4 dark:text-green-300">DMCA and Copyright Policy</Link>.</p>
      </LegalSection>

      <LegalSection title="7. Advertising">
        <p>The service may display advertising supplied by third parties. Ad providers may use cookies or similar technology as described in our Privacy Policy. We do not endorse every product or claim shown in an advertisement.</p>
      </LegalSection>

      <LegalSection title="8. Availability and Changes">
        <p>We may add, modify, suspend, or remove games and features without notice. Games may stop working because of browser changes, provider restrictions, maintenance, network outages, or decisions made by a rights holder.</p>
      </LegalSection>

      <LegalSection title="9. Disclaimer">
        <p>The service is provided on an &quot;as is&quot; and &quot;as available&quot; basis. To the extent permitted by law, we disclaim warranties of merchantability, fitness for a particular purpose, non-infringement, uninterrupted operation, accuracy, and freedom from errors or harmful components.</p>
      </LegalSection>

      <LegalSection title="10. Limitation of Liability">
        <p>To the maximum extent permitted by law, {LEGAL_SITE.name} and its operators will not be liable for indirect, incidental, special, consequential, or punitive damages, lost data, lost profits, or interruption arising from use of or inability to use the service.</p>
      </LegalSection>

      <LegalSection title="11. Suspension and Termination">
        <p>We may restrict access to protect users, enforce these terms, comply with law, or prevent abuse. You may stop using the service at any time and may clear locally stored site data through your browser.</p>
      </LegalSection>

      <LegalSection title="12. Changes and Severability">
        <p>We may update these terms by publishing a revised version and date. Continued use after an update means you accept the revised terms. If a provision is unenforceable, the remaining provisions continue in effect.</p>
      </LegalSection>

      <LegalSection title="13. Contact">
        <p>Questions about these terms may be sent to <LegalContactEmail subject="Terms of Service Question" />.</p>
      </LegalSection>
    </LegalPage>
  );
}
