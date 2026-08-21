import Link from "next/link";
import { LegalContactEmail, LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { createLegalMetadata, LEGAL_SITE } from "@/config/legal-pages";
import { SITE_ROUTES } from "@/config/routes";

export const metadata = createLegalMetadata("privacy");

export default function PrivacyPolicyPage() {
  return (
    <LegalPage pageKey="privacy">
      <LegalSection title="1. Scope">
        <p>This Privacy Policy applies to {LEGAL_SITE.name} and its site-operated APIs. Embedded games and third-party services may process information under their own privacy policies.</p>
      </LegalSection>

      <LegalSection title="2. Information We Process">
        <h3 className="font-black text-gray-900 dark:text-white">Technical and usage information</h3>
        <p>Our hosting, security, analytics, and advertising providers may process IP address, approximate country or region, browser and device type, operating system, referring page, pages viewed, timestamps, interactions, performance information, and diagnostic events.</p>
        <h3 className="pt-2 font-black text-gray-900 dark:text-white">Game and leaderboard information</h3>
        <p>For supported games, we may receive a randomly generated profile ID, nickname, game network identifier, opponent nickname or identifier, match result, kills, deaths, mode, rank type, streaks, achievements, game version, profile revision, and match time. Cloudflare may supply a country code associated with the request. Nicknames, country flags, results, rankings, streaks, and awards can appear publicly.</p>
        <h3 className="pt-2 font-black text-gray-900 dark:text-white">Feedback information</h3>
        <p>If you use the feedback widget or contact us, we process the message and any information you choose to provide. A submitted feedback report may include a screenshot, annotations, page URL, browser details, console errors, and interaction context needed to investigate the issue. Providing an email address is optional unless it is needed to answer your request.</p>
      </LegalSection>

      <LegalSection title="3. Browser Storage">
        <p>We use local browser storage to support guest profiles, game progress, nicknames, favorites, recently viewed games, theme preference, activity-bar preference, and cached leaderboard or activity data. This information generally remains on the device until you clear site data. Changing browser, using private mode, clearing storage, or changing device may reset local progress.</p>
      </LegalSection>

      <LegalSection title="4. How We Use Information">
        <ul className="list-disc space-y-2 pl-5 marker:text-green-600">
          <li>Deliver games and remember player preferences.</li>
          <li>Operate leaderboards, match history, streaks, awards, and activity feeds.</li>
          <li>Maintain security, prevent abuse, deduplicate events, and troubleshoot errors.</li>
          <li>Measure site performance and understand how features are used.</li>
          <li>Display, measure, and improve advertising where enabled.</li>
          <li>Answer support, privacy, feedback, and copyright requests.</li>
          <li>Comply with applicable law and enforce our Terms of Service.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Cookies, Analytics, and Advertising">
        <p>The site may use cookies and similar technologies directly or through service providers. Depending on the active site configuration, these providers may include Google Analytics, Microsoft Clarity, and Google AdSense.</p>
        <p>Microsoft Clarity may record interaction data such as clicks, scrolling, navigation, device information, heatmaps, and session replays so we can diagnose problems and improve usability. Sensitive fields may be masked by the provider, but you should not enter sensitive information into public nicknames or feedback.</p>
        <p>Google and other advertising providers may use cookies to serve or measure ads, including ads based on prior visits where permitted. You can manage Google advertising preferences at <a href="https://adssettings.google.com/" target="_blank" rel="noopener noreferrer" className="font-bold text-green-700 underline underline-offset-4 dark:text-green-300">Google Ads Settings</a>. Learn how Google uses information from partner sites at <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer" className="font-bold text-green-700 underline underline-offset-4 dark:text-green-300">Google&apos;s partner-sites policy</a>.</p>
      </LegalSection>

      <LegalSection title="6. Service Providers and Embedded Games">
        <p>We may rely on providers such as Cloudflare for hosting, security, geolocation, and databases; Photon for multiplayer networking; Google for advertising or analytics; Microsoft Clarity for session analytics; Make This Better for feedback; and third-party game or media hosts. These providers process information as needed to perform their services and may operate in multiple countries.</p>
        <p>When you launch an embedded game, that provider may receive technical request information and may set its own cookies or local storage. Review the applicable provider&apos;s policy when you need more detail.</p>
      </LegalSection>

      <LegalSection title="7. Sharing and Sale">
        <p>We do not sell personal information for money. We may disclose information to service providers, when required by law, to protect users or the service, in connection with a business transfer, or with your direction. Advertising laws in some jurisdictions define certain personalized-ad data transfers more broadly; available browser, consent, and provider controls can be used to manage them.</p>
      </LegalSection>

      <LegalSection title="8. Retention">
        <p>Local information remains until it is cleared from the browser. Server-side match and leaderboard records are retained for as long as reasonably needed to operate rankings, preserve awards, prevent abuse, and maintain the service. Support and legal correspondence may be retained while a request is active and afterward when reasonably necessary for records or compliance. Third-party providers determine retention under their own policies.</p>
      </LegalSection>

      <LegalSection title="9. Your Choices and Rights">
        <p>You can block or delete cookies and local storage in your browser, disable personalized advertising through provider controls, stop using embedded games, or contact us about access, correction, objection, or deletion rights available in your jurisdiction. For a gameplay-data request, include the relevant profile ID so we can identify the record.</p>
        <p>Deleting local browser data does not automatically delete previously uploaded match records. Send a request to <LegalContactEmail subject="Privacy Request" /> if you want us to review server-side data associated with a profile ID.</p>
      </LegalSection>

      <LegalSection title="10. Children&apos;s Privacy">
        <p>The service is not directed to children under 13, and we do not knowingly collect personal information from children under 13. A parent or guardian who believes a child submitted personal information should contact us so we can review and, where appropriate, delete it.</p>
      </LegalSection>

      <LegalSection title="11. Security and International Processing">
        <p>We use reasonable technical and organizational safeguards, but no internet service is completely secure. Information may be processed in countries other than your own because our hosting, analytics, multiplayer, advertising, and support providers operate globally.</p>
      </LegalSection>

      <LegalSection title="12. Changes and Contact">
        <p>We may update this policy when our services, providers, or legal obligations change. The revised version becomes effective when posted with a new date.</p>
        <p>Questions or privacy requests may be sent through our <Link href={SITE_ROUTES.contactUs} className="font-bold text-green-700 underline underline-offset-4 dark:text-green-300">Contact Us</Link> page or to <LegalContactEmail subject="Privacy Question" />.</p>
      </LegalSection>
    </LegalPage>
  );
}
