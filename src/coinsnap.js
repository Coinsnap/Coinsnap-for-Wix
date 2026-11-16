import { secrets } from "wix-secrets-backend.v2";
import { elevate } from "wix-auth";
import { fetch } from "wix-fetch";
import { createHmac, timingSafeEqual } from "crypto";

export const COINSNAP_URL = "https://app.coinsnap.io/";
export const SECRET_API_KEY = "COINSNAP_API_KEY";

const getSecretValue = elevate(secrets.getSecretValue);

export async function readSecret(name) {
  const result = await getSecretValue(name);
  const value = typeof result === "string" ? result : result?.value;
  if (!value) {
    throw new Error(`Secret ${name} is missing from the Wix Secrets Manager`);
  }
  return value;
}

// Null for anything that is not an ISO currency code, so callers reject it.
export function currencyExponent(currency) {
  if (typeof currency !== "string" || !/^[A-Za-z]{3}$/.test(currency)) return null;
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits;
  } catch {
    return null;
  }
}

// Integer minor units to a decimal string, without going through floats.
export function minorToDecimal(minorUnits, exponent) {
  const digits = String(BigInt(minorUnits)).padStart(exponent + 1, "0");
  if (exponent === 0) return digits;
  return `${digits.slice(0, -exponent)}.${digits.slice(-exponent)}`;
}

// Decimal amount (as the invoice API returns it) to integer minor units, as a string.
export function decimalToMinor(amount, exponent) {
  if (!Number.isInteger(exponent)) return null;
  if (typeof amount !== "string" && typeof amount !== "number") return null;
  const [whole, fraction = ""] = String(amount).trim().split(".");
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fraction)) return null;
  if (fraction.slice(exponent).replace(/0/g, "")) return null;
  return String(BigInt(whole + fraction.slice(0, exponent).padEnd(exponent, "0")));
}

// Binds a Wix transaction to the amount it was opened for, so an invoice created
// elsewhere on the store cannot settle it. Keyed with the API key, which only the
// merchant holds.
export function transactionTag(apiKey, wixTransactionId, amountMinor, currency) {
  return createHmac("sha256", apiKey)
    .update(`wix|${wixTransactionId}|${amountMinor}|${String(currency).toUpperCase()}`)
    .digest("hex");
}

export function safeEqual(expected, provided) {
  if (typeof expected !== "string" || typeof provided !== "string") return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function coinsnapRequest(path, apiKey, init = {}) {
  return fetch(COINSNAP_URL + path, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-api-key": apiKey,
    },
  });
}
