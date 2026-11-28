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
  let input = String(raw || "").trim();
  if (!input) {
    return { valid: false, e164: "", digits: "", local10: "", error: "Phone number is empty" };
  }

  // If multiple numbers are separated by /, comma, semicolon, or pipe, take the first one
  if (/[\/,;|]/.test(input)) {
    const firstPart = input.split(/[\/,;|]/).map((s) => s.trim()).find(Boolean);
    if (firstPart) input = firstPart;
  }

  // Handle Excel scientific notation (e.g. 9.87654321E+09 -> 9876543210)
  if (/^\d+(\.\d+)?[eE][+-]?\d+$/.test(input)) {
    const num = Number(input);
    if (Number.isFinite(num) && num > 0) {
      input = Math.round(num).toFixed(0);
    }
  }

  // Strip Excel float decimal suffix like 9876543210.0 or 9876543210.00
  input = input.replace(/\.0+$/, "");

  const strippedPrefix = input.replace(/^tel:/i, "").trim();
  let digitsOnly = strippedPrefix.replace(/[^0-9]/g, "");
  if (!digitsOnly) {
    return { valid: false, e164: "", digits: "", local10: "", error: "No digits found" };
  }

  // Strip international 00 prefix (e.g. 00919876543210 -> 919876543210)
  if (digitsOnly.startsWith("00") && digitsOnly.length > 10) {
    digitsOnly = digitsOnly.slice(2);
  }

  // Handle +91 0XXXXXXXXXX (13 digits starting with 910) -> 91 + 10 digits
  if (digitsOnly.length === 13 && digitsOnly.startsWith("910")) {
    digitsOnly = `91${digitsOnly.slice(3)}`;
  }

  // Indian 11-digit with leading 0 (e.g. 09876543210 -> 9876543210)
  if (digitsOnly.length === 11 && digitsOnly.startsWith("0")) {
    digitsOnly = digitsOnly.slice(1);
  }

  // Any 10-digit number -> +91XXXXXXXXXX
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
    if (REPEATED_DIGITS_REGEX.test(local10)) {
      return {
        valid: false,
        e164: "",
        digits: "",
        local10: "",
        error: `Dummy repeated-digit number "${input}"`,
      };
    }
    return {
      valid: true,
      e164: `+${digitsOnly}`,
      digits: digitsOnly,
      local10,
    };
  }

  // International E.164 (10 to 15 digits)
  if (
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
 * Formats a stored phone number consistently for UI display (e.g., "+91 8695911105").
 */
export function formatPhoneDisplay(raw?: string | null): string {
  if (!raw) return "";
  const s = String(raw).trim();
  if (s.includes("•") || s.includes("*")) return s;
  const res = normalizeAndValidatePhone(s);
  if (!res.valid) return s;
  if (res.e164.startsWith("+91") && res.local10.length === 10) {
    return `+91 ${res.local10}`;
  }
  return res.e164;
}
