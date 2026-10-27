/**
 * Phone Number Masking Utility
 * Protects student contact details from data harvesting and visual snooping.
 * Formats: +91 ••••• ••421 or ••••• ••421
 */

export function maskPhoneNumber(phone?: string | null): string {
  if (!phone || typeof phone !== "string") {
    return "";
  }

  const trimmed = phone.trim();
  if (!trimmed) return "";

  // If already masked, return as-is
  if (isMaskedPhone(trimmed)) {
    return trimmed;
  }

  // Check if country code prefix exists (e.g. +91, +1, +44)
  let prefix = "";
  let digitsPart = trimmed;

  if (trimmed.startsWith("+")) {
    const spaceIndex = trimmed.indexOf(" ");
    if (spaceIndex !== -1 && spaceIndex <= 4) {
      prefix = trimmed.substring(0, spaceIndex + 1); // e.g. "+91 "
      digitsPart = trimmed.substring(spaceIndex + 1).replace(/\s+/g, "");
    } else {
      // Handle cases like "+919876543210" without spaces
      if (trimmed.startsWith("+91") && trimmed.length >= 12) {
        prefix = "+91 ";
        digitsPart = trimmed.substring(3);
      } else if (trimmed.startsWith("+1") && trimmed.length >= 11) {
        prefix = "+1 ";
        digitsPart = trimmed.substring(2);
      } else {
        const matches = trimmed.match(/^(\+\d{1,2})(\d{10})$/);
        if (matches) {
          prefix = matches[1] + " ";
          digitsPart = matches[2];
        }
      }
    }
  }

  const cleanDigits = digitsPart.replace(/[^0-9]/g, "");

  if (cleanDigits.length <= 3) {
    // Too short to mask cleanly, return bullets
    return prefix + "•••";
  }

  const lastThree = cleanDigits.slice(-3);
  const hiddenCount = cleanDigits.length - 3;

  // Format bullets with standard phone grouping (e.g., 5 dots + space + 2 dots)
  let maskedMiddle = "";
  if (hiddenCount >= 7) {
    maskedMiddle = "••••• ••";
  } else if (hiddenCount >= 4) {
    maskedMiddle = "•••• ";
  } else {
    maskedMiddle = "•".repeat(hiddenCount) + " ";
  }

  return `${prefix}${maskedMiddle}${lastThree}`;
}

/**
 * Checks if a phone string is already in masked state
 */
export function isMaskedPhone(phone?: string | null): boolean {
  if (!phone || typeof phone !== "string") return false;
  return phone.includes("•") || phone.includes("*");
}

/**
 * Strips all non-digit characters for tel: and wa.me protocols
 */
export function cleanPhoneDigits(phone?: string | null): string {
  if (!phone || typeof phone !== "string") return "";
  return phone.replace(/[^0-9]/g, "");
}
