import { ArrowLeft, BriefcaseBusiness } from 'lucide-react'
import { Link } from 'react-router-dom'

const sections = {
  terms: {
    title: 'Terms and Conditions',
    updated: 'October 19, 2026',
    introduction: 'These Terms and Conditions govern access to HamsafarHub, a professional workspace for matrimonial consultants to maintain client profiles, discover potential introductions, and coordinate consent-based contact between consultants. By creating an account or using the service, you agree to these terms. If you do not agree, do not use the service.',
    items: [
      ['1. Who may use HamsafarHub', 'You must be at least 18 years old, have authority to act for your consultancy, and provide accurate account information. Consultant accounts are subject to administrator approval and the applicable paid subscription. Administrators provision their accounts separately. You are responsible for keeping your login credentials confidential and for activity carried out through your account. Tell the platform operator promptly if you suspect unauthorized access.'],
      ['2. Consultant responsibilities and client permission', 'You may add a client profile only when you have a lawful basis and the client’s permission to collect and use the information for matrimonial introductions, including the client’s photograph. Explain to each client what information and image are recorded, that they may be used for matching, and how profile details may be shared. Keep information accurate and current, correct it when asked, and remove or request removal of information when you no longer have permission or a lawful reason to retain it. Do not submit information about a person who has not authorized you to act on their behalf.'],
      ['3. Sensitive and prohibited information', 'Collect only information reasonably needed for matchmaking and coordination. Matrimonial information can be highly personal, including age, gender, caste, marital history, income, property, and contact details. Do not use the service to discriminate unlawfully, harass, threaten, stalk, exploit, or endanger anyone. Do not enter government identification numbers, financial account credentials, passwords, or unrelated sensitive information into profile fields.'],
      ['4. Matching and introductions', 'HamsafarHub provides rule-based suggestions using profile details and the structured preferences currently supported by the service. Suggestions are preliminary, may be incomplete or unsuitable, and are not a guarantee of compatibility, safety, accuracy, or a successful relationship. Consultants must independently verify information, discuss suitability with their clients, and use professional judgment. Do not treat a match score as a decision about a person’s worth or as a substitute for client consent.'],
      ['5. Privacy and consent-gated contact', 'Profile information is available only as described in the Privacy Policy and the access controls in the service. Contact details are restricted to the consultant who manages the profile and platform administrators, and may be revealed to another consultant through the coordination workflow after the receiving consultant approves the request. Do not copy, export, disclose, or use client information outside the purpose authorized by the client. Approval to coordinate is not a substitute for the client’s own consent to an introduction.'],
      ['6. Subscriptions, fees, and payment', 'Subscription tiers, prices, billing intervals, and applicable taxes or charges are shown in the service or checkout before purchase. Subscriptions renew according to the selected plan until cancelled through any available account or provider process. Safepay or another designated payment provider processes payment details; HamsafarHub does not ask you to enter card details into profile or account fields. Payment confirmation and workspace access are subject to provider verification and any separate administrator approval. Contact the platform operator about billing questions, cancellation, or refunds; refunds are subject to applicable law and the terms shown at purchase.'],
      ['7. Acceptable use and account action', 'Do not probe, disrupt, reverse engineer, bypass access controls, scrape profiles, impersonate another person, upload malicious code, or use the service to send unsolicited communications. We may restrict, suspend, or terminate access when reasonably necessary to protect users, investigate suspected misuse, comply with law, or enforce these terms. Where appropriate, we will provide notice and an opportunity to address the issue. You may stop using the service and ask the operator to close your account, subject to legal, safety, payment, and record-keeping obligations.'],
      ['8. Your content and service availability', 'You retain responsibility for the information you submit and confirm that you have the rights and permissions needed to provide it. You authorize HamsafarHub to host, process, and display that information only as needed to operate, secure, support, and improve the service in accordance with the Privacy Policy. We aim to keep the service available and protect it, but cannot promise uninterrupted operation or that every record or suggestion is error-free. We may update or discontinue features, with notice where reasonably practicable.'],
      ['9. Disclaimers and liability', 'To the extent permitted by applicable law, HamsafarHub is provided on an “as available” basis. The platform is a tool for consultants, not a matrimonial agency, identity-verification service, background-check provider, safety guarantee, or a party to introductions or relationships. Consultants remain responsible for client permission, the accuracy of submitted information, professional conduct, and decisions made using suggestions. Nothing in these terms limits rights or remedies that cannot lawfully be excluded.'],
      ['10. Changes, governing law, and contact', 'We may revise these terms as the service or legal requirements change. Material revisions will be communicated through the service or another reasonable channel; continued use after the effective date means acceptance where permitted by law. HamsafarHub is operated by Shagufta Durani. The law and dispute forum applicable to the operator and user will be determined consistently with mandatory applicable law. For account, terms, or complaint requests, call or WhatsApp the administrator at +92 3080163990.'],
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    updated: 'October 19, 2026',
    introduction: 'This Privacy Policy explains how the HamsafarHub platform operator handles information in its professional matrimonial-consultant workspace. It applies to consultants, administrators, and client information entered by consultants. The operator acts as the platform service provider; consultants remain responsible for their own collection of client information and must explain their practices to clients and obtain any permission or other lawful basis required before using the service.',
    items: [
      ['1. Information we handle', 'Account information includes consultant or administrator name, email address, consultant phone number, consultant date of birth (to confirm minimum age eligibility), password hash, role, account approval, and subscription status. Consultant-provided client profiles include a client photograph and may include the client’s name, gender, date of birth, age derived from date of birth, height, property size, education, profession, income range, marital status and history, caste, city, phone number, email, location, preferences, description, and matching requirements. The platform also processes profile ownership, visibility, timestamps, coordination requests and their status, messages where enabled, and subscription, payment, and webhook references needed to operate the service. Do not submit government IDs, payment-card credentials, or information unrelated to matchmaking.'],
      ['2. How information is used and the reasons for processing', 'We use information to create and secure accounts, approve consultants, provide profile storage and search, calculate rule-based compatibility suggestions, route coordination requests, enforce contact-detail access controls, provide messaging where available, process subscriptions through the payment provider, respond to support requests, prevent abuse, troubleshoot service issues, and meet legal obligations. Depending on the purpose and applicable law, processing is based on providing the service requested under the account or subscription, a consultant’s or client’s permission or other lawful basis for profile data, legitimate interests in protecting and operating the service, or legal obligations. We do not use profile data to make legal or similarly significant decisions about a person. Match suggestions are decision support for consultants, not a guarantee or automated final decision.'],
      ['3. Who can see information', 'The consultant who uploaded a profile can access that profile, its photograph, and its contact details. Platform administrators can access account and client-profile information, including photographs, for platform administration, review, support, and safety. In matching results, other consultants may view the matched client’s profile details, including the photograph, demographics, preferences, description, and requirements, together with the uploading consultant’s name and phone number. The client’s phone number and email address are not shown to other consultants unless an approved coordination request enables the requesting consultant to view those contact details through the service. This access is for matrimonial introductions only and does not replace the client’s consent. We may disclose information to service providers acting for us, or to authorities or other parties when required or permitted by law, to protect rights and safety, or to handle a business transfer subject to appropriate protections.'],
      ['4. Matching, automation, and client choice', 'Matching uses profile details and structured preferences supported by the product, including gender, caste preferences, height preferences, and property rules, along with other profile characteristics used to rank compatibility. The service may exclude profiles that do not satisfy required rules. Results can be inaccurate or limited by missing or outdated information. Free-text descriptions and requirements are not necessarily interpreted as formal matching rules. Consultants must review suggestions with clients and obtain permission before arranging or sharing an introduction.'],
      ['5. Payments and third-party services', 'Hosted checkout is provided by Safepay or the payment provider identified at checkout. The provider receives payment information directly under its own privacy terms. HamsafarHub stores subscription status and limited transaction or provider references for reconciliation and support, not full card numbers or card security codes. We rely on infrastructure, database, communications, and security providers configured by the operator to host and operate the platform; those providers may process information on our instructions and under applicable agreements. Their own notices also apply to services they operate.'],
      ['6. Security and storage', 'We use access controls, authentication, password hashing, and server-side storage to reduce unauthorized access. No system or transmission is completely secure, and we cannot guarantee absolute security. Account tokens are kept in the active browser session; do not use a shared or untrusted device for sensitive work, and sign out when finished. Tell the platform operator promptly about suspected account compromise or unintended disclosure.'],
      ['7. Retention and deletion', 'We retain account, profile, coordination, and payment records for as long as needed to operate the service, maintain security and auditability, resolve disputes, and meet legal or contractual obligations. Retention periods depend on the record and applicable requirements; this product does not currently promise automatic deletion after a fixed period. Consultants should remove profiles they are no longer authorized to maintain. You may ask the platform operator to correct or delete information or close an account; some records may need to be retained where lawfully required or necessary for legitimate platform, safety, or dispute purposes.'],
      ['8. Your choices and rights', 'Depending on where you live, you may have rights to request access to, correction of, deletion of, restriction of, or a copy of personal information, or to object to certain processing. Contact the platform operator through the official HamsafarHub support channel to make a request. We may need to verify your identity and authority, and will respond as required by applicable law. A client whose profile was submitted by a consultant should contact that consultant or the platform operator; we may need to verify the client’s identity before acting. You may also have the right to complain to a relevant privacy regulator.'],
      ['9. Children and international use', 'The service is intended for adults and client profiles must concern adults. Do not create or submit a profile for anyone under 18. Information may be processed in the countries where the operator and its service providers operate. International transfers are conducted in accordance with applicable law and with the required transfer mechanisms and safeguards.'],
      ['10. Policy updates and contact', 'We may update this policy to reflect changes in the product, providers, or legal obligations. We will post the current version and its effective date here and communicate material changes through a reasonable channel. HamsafarHub is operated by Shagufta Durani. For privacy questions, access or deletion requests, or complaints, call or WhatsApp the administrator at +92 3080163990.'],
    ],
  },
}

function LegalPage({ type }) {
  const page = sections[type]
  return (
    <main className="min-h-screen bg-[#f5f7f4] px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link to="/login" className="flex items-center gap-2.5 text-[#203c31] no-underline">
            <span className="grid size-9 place-items-center rounded-lg bg-[#1d4c39] text-white"><BriefcaseBusiness size={17} /></span>
            <span className="font-display text-base font-extrabold">HamsafarHub</span>
          </Link>
          <Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-[#477454] no-underline hover:text-[#1e6348]"><ArrowLeft size={16} /> Back to sign in</Link>
        </header>
        <article className="border border-[#e2e9e3] bg-white px-5 py-7 sm:px-10 sm:py-10">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#568069]">HamsafarHub · Effective {page.updated}</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-[#20372c] sm:text-4xl">{page.title}</h1>
          <p className="mt-5 text-sm leading-7 text-[#58695f]">{page.introduction}</p>
          <div className="mt-8 space-y-7">
            {page.items.map(([heading, content]) => (
              <section key={heading}>
                <h2 className="font-display text-lg font-bold text-[#20372c]">{heading}</h2>
                <p className="mt-2 text-sm leading-7 text-[#58695f]">{content}</p>
              </section>
            ))}
          </div>
          <section className="mt-6 rounded-lg border border-[#dfe7e0] bg-[#f8faf7] p-4">
            <h2 className="font-semibold text-[#31453a]">Contact the operator</h2>
            <p className="mt-1 text-sm text-[#718078]">Shagufta Durani · +92 3080163990</p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold">
              <a href="tel:+923080163990" className="text-[#1e6348] underline">Call</a>
              <a href="https://wa.me/923080163990" target="_blank" rel="noreferrer" className="text-[#1e6348] underline">WhatsApp</a>
            </div>
          </section>
        </article>
      </div>
    </main>
  )
}

export function TermsAndConditions() {
  return <LegalPage type="terms" />
}

export function PrivacyPolicy() {
  return <LegalPage type="privacy" />
}
