/**
 * Canonical phone number normalization & validation utility.
 * Standardizes valid numbers to E.164 (+91XXXXXXXXXX for Indian 10-digit numbers)
 * and rejects malformed / dummy / too-short numbers.
 */

export interface PhoneValidationResult {
  valid: boolean;
  e164: string;
  digits: string;
  local10: string;
  error?: string;
}

const REPEATED_DIGITS_REGEX = /^(\d)\1{6,}$/;

export function normalizeAndValidatePhone(raw?: string | null): PhoneValidationResult {
  const input = String(raw || "").trim();
  if (!input) {
    return { valid: false, e164: "", digits: "", local10: "", error: "Phone number is empty" };
  }

  // Reject if it contains letters (aside from an optional 'tel:' prefix)
  const strippedPrefix = input.replace(/^tel:/i, "").trim();
  if (/[a-zA-Z]/.test(strippedPrefix)) {
    return {
      valid: false,
      e164: "",
      digits: "",
      local10: "",
      error: `Invalid characters in phone number "${input}"`,
    };
  }

  let digitsOnly = strippedPrefix.replace(/[^0-9]/g, "");
  if (!digitsOnly) {
    return { valid: false, e164: "", digits: "", local10: "", error: "No digits found" };
  }

  // Strip international 00 prefix (e.g. 00919876543210 -> 919876543210)
  if (digitsOnly.startsWith("00") && digitsOnly.length > 10) {
    digitsOnly = digitsOnly.slice(2);
  }

  // Indian 11-digit with leading 0 (e.g. 09876543210 -> 9876543210)
  if (digitsOnly.length === 11 && digitsOnly.startsWith("0")) {
    digitsOnly = digitsOnly.slice(1);
  }

  // Bare 10-digit Indian number -> +91XXXXXXXXXX
  if (digitsOnly.length === 10) {
    if (REPEATED_DIGITS_REGEX.test(digitsOnly)) {
      return {
        valid: false,
        e164: "",
        digits: "",
        local10: "",
        error: `Dummy repeated-digit number "${input}"`,
      };
    }
    if (!/^[5-9]\d{9}$/.test(digitsOnly)) {
      return {
        valid: false,
        e164: "",
        digits: "",
        local10: "",
        error: `Invalid 10-digit Indian mobile number "${input}" (must start with 5-9)`,
      };
    }
    return {
      valid: true,
      e164: `+91${digitsOnly}`,
      digits: `91${digitsOnly}`,
      local10: digitsOnly,
    };
  }

  // 12-digit Indian number with 91 prefix
  if (digitsOnly.length === 12 && digitsOnly.startsWith("91")) {
    const local10 = digitsOnly.slice(2);
    if (REPEATED_DIGITS_REGEX.test(local10) || !/^[5-9]\d{9}$/.test(local10)) {
      return {
        valid: false,
        e164: "",
        digits: "",
        local10: "",
        error: `Invalid Indian mobile number "${input}"`,
      };
    }
    return {
      valid: true,
      e164: `+${digitsOnly}`,
      digits: digitsOnly,
      local10,
    };
  }

  // International E.164 (10 to 15 digits with explicit country code or '+')
  if (
    (strippedPrefix.startsWith("+") || digitsOnly.length >= 11) &&
    digitsOnly.length >= 10 &&
    digitsOnly.length <= 15 &&
    !REPEATED_DIGITS_REGEX.test(digitsOnly)
  ) {
    return {
      valid: true,
      e164: `+${digitsOnly}`,
      digits: digitsOnly,
      local10: digitsOnly.slice(-10),
    };
  }

  return {
    valid: false,
    e164: "",
    digits: "",
    local10: "",
    error: `Invalid phone length (${digitsOnly.length} digits) for "${input}"`,
  };
}

/**
 * Formats a stored phone number consistently for UI display (e.g., "+91 86959 11105").
 */
export function formatPhoneDisplay(raw?: string | null): string {
  if (!raw) return "";
  const res = normalizeAndValidatePhone(raw);
  if (!res.valid) return String(raw);
  if (res.e164.startsWith("+91") && res.local10.length === 10) {
    return `+91 ${res.local10.slice(0, 5)} ${res.local10.slice(5)}`;
  }
  return res.e164;
}
