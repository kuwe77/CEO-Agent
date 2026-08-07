const HERMES_PROFILE_LABEL = /^[a-z0-9]+$/;

/**
 * Resolve a human-readable logical profile label to a host profile owned by
 * one Paperclip company. The company prefix prevents tenants sharing an
 * execution host from selecting another company's Hermes memory/config home.
 */
export function resolveCompanyHermesProfile(companyId: string, profileLabel: string): string {
  const label = profileLabel.trim();
  if (!HERMES_PROFILE_LABEL.test(label)) {
    throw new Error("Hermes profile labels must be lowercase alphanumeric");
  }

  const companyKey = companyId.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!companyKey) {
    throw new Error("A valid company id is required to resolve a Hermes profile");
  }

  return `pc${companyKey}${label}`;
}
