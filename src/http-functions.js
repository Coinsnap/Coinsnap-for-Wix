import wixPaymentProviderBackend from "wix-payment-provider-backend";
import { ok, badRequest, serverError } from "wix-http-functions";
import {
  SECRET_API_KEY,
  coinsnapRequest,
  currencyExponent,
  decimalToMinor,
  readSecret,
  safeEqual,
  transactionTag,
} from "backend/coinsnap";

// Coinsnap invoice status -> Wix transaction event fields. An event without a
// reasonCode is an approval, so only Settled may be sent without one.
const EVENTS = {
  Processing: { reasonCode: 5005 },
  Settled: {},
  Expired: { reasonCode: 3030, errorCode: "BUYER_CANCELED", errorMessage: "The Coinsnap invoice expired" },
};

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Served at /_functions/post_coinsnapWebhook, the URL merchants already registered.
// The request is only a hint that an invoice changed: anyone can send one, so every
// fact acted on is read back from the Coinsnap API with the merchant's key.
export async function use_post_coinsnapWebhook(request) {
  const payload = parseJson(await request.body.text());
  const invoiceId = payload?.invoiceId;
  const storeId = payload?.metadata?.wixStoreId;
  if (typeof invoiceId !== "string" || typeof storeId !== "string") return ok();

  const apiKey = await readSecret(SECRET_API_KEY);
  const response = await coinsnapRequest(
    `api/v1/stores/${encodeURIComponent(storeId)}/invoices/${encodeURIComponent(invoiceId)}`,
    apiKey,
    { method: "get" },
  );
  if (response.status >= 500) {
    console.error(`Coinsnap invoice ${invoiceId} could not be read: HTTP ${response.status}`);
    return serverError();
  }
  if (response.status !== 200) {
    console.warn(`Coinsnap webhook for unknown invoice ${invoiceId}: HTTP ${response.status}`);
    return badRequest();
  }

  const invoice = await response.json();
  const metadata =
    (typeof invoice.metadata === "string" ? parseJson(invoice.metadata) : invoice.metadata) ?? {};
  const wixTransactionId = metadata.wixTransactionID;
  const event = EVENTS[invoice.status];
  if (!event || typeof wixTransactionId !== "string") return ok();

  const amountMinor = decimalToMinor(invoice.invoiceAmount, currencyExponent(invoice.currency));
  const expectedTag =
    amountMinor && transactionTag(apiKey, wixTransactionId, amountMinor, invoice.currency);
  if (!expectedTag || !safeEqual(expectedTag, metadata.wixTag)) {
    console.warn(`Coinsnap invoice ${invoice.id} does not match the Wix transaction it names`);
    return badRequest();
  }

  await wixPaymentProviderBackend.submitEvent({
    event: {
      transaction: {
        wixTransactionId,
        pluginTransactionId: invoice.id,
        ...event,
      },
    },
  });
  return ok();
}
