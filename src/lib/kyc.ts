/** Worker identity KYC. Stored as id_verification_status on workers. */

export const KYC_VERIFIED = "verified";
export const KYC_APPROVED = "approved";
export const KYC_PENDING = "pending";
export const KYC_REJECTED = "rejected";
export const KYC_UNVERIFIED = "unverified";

export const ID_DOCUMENT_KINDS = [
  { id: "aadhaar", en: "Aadhaar", hi: "आधार" },
  { id: "pan", en: "PAN card", hi: "पैन कार्ड" },
  { id: "voter_id", en: "Voter ID", hi: "वोटर आईडी" },
  { id: "driving_license", en: "Driving licence", hi: "ड्राइविंग लाइसेंस" },
  { id: "passport", en: "Passport", hi: "पासपोर्ट" },
  { id: "other_gov_id", en: "Other government ID", hi: "अन्य सरकारी आईडी" },
] as const;

export function isKycApproved(status?: string | null) {
  return status === KYC_VERIFIED || status === KYC_APPROVED;
}

export function kycLabel(status?: string | null) {
  if (isKycApproved(status)) return "KYC Approved";
  if (status === KYC_REJECTED) return "KYC Rejected";
  if (status === KYC_PENDING) return "KYC Pending";
  return "KYC not submitted";
}

export function kycKindLabel(kind: string, hi?: boolean) {
  const row = ID_DOCUMENT_KINDS.find((k) => k.id === kind);
  if (!row) return kind;
  return hi ? row.hi : row.en;
}

export function normalizeKycWrite(status?: string | null) {
  if (isKycApproved(status)) return KYC_VERIFIED;
  if (status === KYC_REJECTED) return KYC_REJECTED;
  if (status === KYC_PENDING) return KYC_PENDING;
  return KYC_UNVERIFIED;
}

export const KYC_PUBLIC_MESSAGE =
  "KYC verification required before your profile can go public.";
export const KYC_PUBLIC_MESSAGE_HI =
  "प्रोफ़ाइल पब्लिक होने से पहले KYC वेरिफिकेशन ज़रूरी है।";
