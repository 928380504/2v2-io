import { LegalContactEmail, LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { createLegalMetadata, LEGAL_SITE } from "@/config/legal-pages";

export const metadata = createLegalMetadata("dmca");

export default function DmcaPage() {
  return (
    <LegalPage pageKey="dmca">
      <LegalSection title="Reporting Alleged Infringement">
        <p>
          If you are a copyright owner or an authorized representative and believe material available through {LEGAL_SITE.name} infringes your rights, send a written notice containing the information below. We process notices consistent with the Digital Millennium Copyright Act and other applicable copyright laws.
        </p>
      </LegalSection>

      <LegalSection title="Required Information">
        <ol className="list-decimal space-y-2 pl-5 marker:font-bold marker:text-green-700 dark:marker:text-green-300">
          <li>A physical or electronic signature of the copyright owner or authorized representative.</li>
          <li>Identification of the copyrighted work, or a representative list when one notice covers multiple works.</li>
          <li>The exact URL and enough detail for us to locate the material claimed to be infringing.</li>
          <li>Your full name and reasonably sufficient contact information, including a valid email address.</li>
          <li>A statement that you have a good-faith belief the disputed use is not authorized by the owner, its agent, or the law.</li>
          <li>A statement that the notice is accurate and, under penalty of perjury, that you are the owner or authorized to act for the owner.</li>
        </ol>
      </LegalSection>

      <LegalSection title="Where to Send a Notice">
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-700 dark:bg-green-900/50">
          <p><strong>Email:</strong> <LegalContactEmail subject={`DMCA Takedown Request - ${LEGAL_SITE.name}`} /></p>
          <p><strong>Subject:</strong> DMCA Takedown Request - {LEGAL_SITE.name}</p>
          <p><strong>Website:</strong> {LEGAL_SITE.url}</p>
        </div>
      </LegalSection>

      <LegalSection title="Our Response">
        <p>We may remove or disable access to material while reviewing a valid notice and may contact the sender or affected content provider for clarification. We aim to acknowledge complete notices promptly, but investigation time depends on the complexity of the request.</p>
      </LegalSection>

      <LegalSection title="Counter-Notification">
        <p>If material you provided was removed because of a mistake or misidentification, you may send a counter-notification identifying the removed material, its former location, your contact details, a statement under penalty of perjury that removal resulted from mistake or misidentification, consent to an appropriate legal jurisdiction, acceptance of service from the original claimant, and your signature.</p>
      </LegalSection>

      <LegalSection title="Good-Faith Notices">
        <p>Knowingly submitting a materially false claim may create legal liability. Please consider applicable licenses, permissions, and fair-use principles before sending a notice. This page provides procedural information and is not legal advice.</p>
      </LegalSection>

      <LegalSection title="Repeat Infringement and Policy Changes">
        <p>Where appropriate, we may restrict access associated with repeated infringement. We may update this policy as our services or legal obligations change.</p>
      </LegalSection>
    </LegalPage>
  );
}
