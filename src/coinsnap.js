import { secrets } from "wix-secrets-backend.v2";
import wixData from "wix-data";
import { elevate } from "wix-auth";
import { fetch } from "wix-fetch";
import { createHmac, timingSafeEqual } from "crypto";

export const COINSNAP_URL = "https://app.coinsnap.io/";
export const SECRET_API_KEY = "COINSNAP_API_KEY";
export const SECRET_WEBHOOK = "COINSNAP_WEBHOOK_SECRET";
// CMS collection holding one record per invoice the plugin created, and one per
// Wix transaction it approved. Its permissions must be "Admin" only.
export const RECORDS = "CoinsnapInvoices";
export const SIGNATURE_MAX_AGE = 300;

const getSecretValue = elevate(secrets.getSecretValue);
const DATA_OPTIONS = { suppressAuth: true };

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

// X-Coinsnap-Signature: t=<unix time>,v1=<hex HMAC-SHA256 of "t.body">.
// Returns null when valid, otherwise the reason to log. An empty secret rejects
// everything: an HMAC with an empty key is one anyone can compute.
export function signatureProblem(header, rawBody, secret, now = Math.floor(Date.now() / 1000)) {
  if (typeof secret !== "string" || secret === "") return "bad signature";
  const parts = {};
  for (const part of String(header ?? "").split(",")) {
    const i = part.indexOf("=");
    if (i > 0) parts[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  const t = /^\d+$/.test(parts.t ?? "") ? Number(parts.t) : 0;
  if (t <= 0) return "bad signature";
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  if (!safeEqual(expected, parts.v1 ?? "")) return "bad signature";
  if (Math.abs(now - t) > SIGNATURE_MAX_AGE) return "stale timestamp";
  return null;
}

// Coinsnap invoice status -> Wix transaction event fields. An event without a
// reasonCode is an approval, so only Settled may be sent without one.
export const EVENTS = {
  Processing: { reasonCode: 5005 },
  Settled: {},
  Expired: { reasonCode: 3030, errorCode: "BUYER_CANCELED", errorMessage: "The Coinsnap invoice expired" },
};

function invoiceMetadata(invoice) {
  if (typeof invoice?.metadata !== "string") return invoice?.metadata ?? {};
  try {
    return JSON.parse(invoice.metadata) ?? {};
  } catch {
    return {};
  }
}

// What a fetched invoice means for the Wix transaction in our own record.
// Returns { action: "approve" | "pending" | "cancel" | "ignore", reason }.
// Only "approve" marks the order paid, and only when the invoice is Settled, is the
// one recorded for this transaction, and pays the recorded amount in its currency.
export function decidePayment(invoice, record, apiKey) {
  const status = typeof invoice?.status === "string" ? invoice.status : "?";
  const metadata = invoiceMetadata(invoice);
  if (
    !record ||
    typeof record.wixTransactionId !== "string" ||
    invoice?.id !== record.invoiceId ||
    metadata.wixTransactionID !== record.wixTransactionId
  ) {
    return { action: "ignore", reason: "not ours" };
  }
  // The tag, written into the invoice at checkout, proves the record was not edited.
  const tag = transactionTag(apiKey, record.wixTransactionId, record.amountMinor, record.currency);
  if (!safeEqual(tag, metadata.wixTag)) return { action: "ignore", reason: "not ours" };

  if (status === "Processing") return { action: "pending", reason: "status Processing" };
  if (status === "Expired") return { action: "cancel", reason: "status Expired" };
  if (status !== "Settled") return { action: "ignore", reason: `status ${status}` };

  const currency = String(invoice.currency ?? "").toUpperCase();
  const exponent = currencyExponent(currency);
  const paid = decimalToMinor(invoice.invoiceAmount ?? invoice.fiatAmount, exponent);
  const expected = /^\d+$/.test(String(record.amountMinor)) ? BigInt(record.amountMinor) : 0n;
  if (expected <= 0n || paid === null || currency !== String(record.currency).toUpperCase()) {
    return { action: "ignore", reason: "amount mismatch" };
  }
  const diff = BigInt(paid) - expected;
  // One minor unit (0.01 in EUR) for rounding, as in the guide.
  if (diff < -1n || diff > 1n) return { action: "ignore", reason: "amount mismatch" };
  return { action: "approve", reason: "settled" };
}

// Logs what happened, never secrets, bodies, headers, store IDs or customer data.
export function logWebhook(level, reason, invoiceId = "") {
  const id = String(invoiceId ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) || "-";
  const line = `[coinsnap] ${level.toUpperCase()} webhook reason=${reason} invoice=${id}`;
  if (level === "security") console.warn(line);
  else console.info(line);
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

// Records live in a CMS collection, not in memory or a cache (guide 6.9). Inserting
// an existing _id fails, which is what makes "act once" hold under concurrent retries.
export const records = {
  invoiceKey: (invoiceId) => `inv-${invoiceId}`,
  paidKey: (wixTransactionId) => `paid-${wixTransactionId}`,
  async get(id) {
    return (await wixData.get(RECORDS, id, DATA_OPTIONS)) ?? null;
  },
  // True when inserted, false when a record with this _id already exists.
  async insertOnce(item) {
    try {
      await wixData.insert(RECORDS, item, DATA_OPTIONS);
      return true;
    } catch (error) {
      if (error?.code === "WDE0074" || /already exists/i.test(String(error?.message))) return false;
      throw error;
    }
  },
  async remove(id) {
    await wixData.remove(RECORDS, id, DATA_OPTIONS);
  },
};
