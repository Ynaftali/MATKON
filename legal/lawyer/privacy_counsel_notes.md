\newpage

# Annex A: Notes for New Zealand Counsel (Privacy Policy)

> This annex is for the reviewing lawyer only and is not part of the customer-facing document. It was prepared by the operator (not a lawyer) to flag points that need professional review. The whole policy requires review by a qualified New Zealand lawyer before publication beyond a closed beta.

**General.** The operator is currently a sole individual with no registered entity, located in New Zealand. Registering a NZ limited liability company before a public launch is the single largest liability mitigation and is planned. Users are Israelis worldwide, creating multi-jurisdictional exposure (NZ Privacy Act 2020 + GDPR for EU users). There are no real users yet beyond the operator.

**Section 1 (Introduction / Operator).** Confirm whether the GDPR/NZ Privacy Act require the controller/agency to be named with a physical contact address, or whether a generic "operator" descriptor is acceptable at the closed-beta stage. Consider whether an EU representative (GDPR Art 27) is required once EU users are onboarded.

**Section 2 (What we collect).** Consider whether recipe content may reveal special-category data under GDPR Art 9 (for example religion via kosher/halal, health via allergies) even though volunteered by the user. The free-text bio field may also contain additional personal data.

**Section 3 (How we collect).** Confirm that functional-only localStorage (no tracking or advertising) is exempt from a consent banner in the relevant jurisdictions (expanded in Section 7).

**Section 4 (Purposes / legal basis).** If EU users are onboarded, prepare an internal Legitimate Interests Assessment (LIA) for each Art 6(1)(f) purpose.

**Section 5 (Processors).** Confirm that Data Processing Agreements and, for EU transfers, Standard Contractual Clauses are in place with each provider. Verify the actual Vercel function region in the dashboard. Consider whether Pollinations' distributed infrastructure requires further transfer disclosure. Consider adding a link to Anthropic's policy that it does not train models on API inputs. **Added 20 July 2026:** Supadata (video-link recipe extraction, Dumpling Software UG, Berlin) is a new processor; needs the same DPA/SCC treatment as the other EU-based providers.

**Section 6 (International transfers).** Confirm the actual transfer mechanism. Japan holds an EU adequacy decision; US transfers may rely on the Data Privacy Framework or Standard Contractual Clauses. Confirm the wording satisfies NZ Privacy Act IPP 12 (cross-border disclosure).

**Section 7 (Cookies / storage).** If analytics is added in future, this section must change and a consent banner may be required. None is used at present (verified in code).

**Section 8 (Retention).** Consider specifying concrete retention periods (for example server logs X days; acceptance log = limitation period). Confirm that retaining the IP/acceptance log after account deletion is compatible with the right to erasure (GDPR Art 17(3)(e)).

**Section 9 (Rights).** NZ law does not grant portability/objection in the same terms as GDPR; the "subject to applicable law / where applicable" wording is intended to cover this. The complaint-to-authority right is placed in Section 14. Operationally, access and portability requests are currently fulfilled manually on request (a self-service export is planned).

**Section 10 (Security).** Define the breach-notification procedure and timelines (NZ notifiable privacy breach to the Privacy Commissioner and affected individuals; GDPR 72 hours). Confirm the security representations match the actual implementation.

**Section 11 (Children).** The age of digital consent varies by jurisdiction (some EU states set 13 to 15). Age 16 is the GDPR default. Confirm against target audiences.

**Section 12 (AI processing).** Consider a statement that Anthropic does not train on API inputs, and confirm the image-moderation wording. Related product task: label AI-generated images (EU AI Act Art 50).

**Section 13 (Changes).** A material change to the processing basis may require active re-consent under GDPR, not only "continued use = acceptance".

**Section 14 (Contact / complaint).** The privacy@, copyright@ and support@ mailboxes do not yet exist and must be set up before launch. Verify the current NZ Privacy Commissioner complaint path.
