import {
  LegalContactEmail,
  LegalPage,
  LegalSection,
} from "@/components/legal/LegalPage";
import { createLegalMetadata } from "@/config/legal-pages";

export const metadata = createLegalMetadata("contactUs");

export default function ContactUsPage() {
  return (
    <LegalPage pageKey="contactUs">
      <LegalSection title="Email">
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-700 dark:bg-green-900/50">
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">
            General contact
          </p>
          <p className="mt-1 text-lg">
            <LegalContactEmail />
          </p>
        </div>
      </LegalSection>

      <LegalSection title="What We Can Help With">
        <ul className="list-disc space-y-2 pl-5 marker:text-green-600">
          <li>Games that fail to load, freeze, or display incorrectly.</li>
          <li>Keyboard, mouse, touch, audio, or fullscreen problems.</li>
          <li>Incorrect game information, broken links, and bug reports.</li>
          <li>Suggestions for games, tags, rankings, or site improvements.</li>
          <li>Privacy questions and requests relating to site data.</li>
          <li>Copyright and content removal requests.</li>
          <li>Business, advertising, and partnership inquiries.</li>
        </ul>
      </LegalSection>

      <LegalSection title="What to Include">
        <p>
          Please include the page URL, device and browser, a short description
          of what happened, and the steps that reproduce the problem. A
          screenshot is helpful when the issue is visual. For leaderboard or
          match-record questions, include your guest nickname and profile ID if
          available.
        </p>
        <p>
          Do not send passwords, payment details, authentication codes, or any
          other sensitive information. We do not need those details to provide
          support.
        </p>
      </LegalSection>

      <LegalSection title="Response Time">
        <p>
          We aim to review messages within three business days. Copyright,
          security, and service-wide technical reports receive priority, while
          complex investigations may take longer.
        </p>
      </LegalSection>

      <LegalSection title="Copyright Notices">
        <p>
          Formal copyright notices should follow the requirements on our DMCA
          page and use the subject line shown there.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
