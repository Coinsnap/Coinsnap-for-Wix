import wixPaymentProviderBackend from "wix-payment-provider-backend";
import { ok, response } from "wix-http-functions";
import {
  EVENTS,
  SECRET_API_KEY,
  SECRET_WEBHOOK,
  coinsnapRequest,
  decidePayment,
  logWebhook,
  readSecret,
  records,
  signatureProblem,
} from "backend/coinsnap";

const status = (code) => response({ status: code, headers: { "Content-Type": "text/plain" }, body: "" });
const unauthorized = () => response({ status: 401, headers: { "Content-Type": "text/plain" }, body: "Unauthorized" });
const retryLater = () => status(503);

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function submit(wixTransactionId, invoiceId, event) {
  await wixPaymentProviderBackend.submitEvent({
    event: { transaction: { wixTransactionId, pluginTransactionId: invoiceId, ...event } },
  });
}

// Served at /_functions/post_coinsnapWebhook, the URL merchants already registered.
// The body is only a hint that an invoice changed: after the signature check, only
// invoiceId is read from it, and every fact acted on comes from the Coinsnap API and
// from the record createTransaction stored.
export async function use_post_coinsnapWebhook(request) {
  const rawBody = await request.body.text();

  // 1. Signature over the raw body, before anything else.
  let secret = "";
  try {
    secret = await readSecret(SECRET_WEBHOOK);
  } catch {
    secret = "";
  }
  const problem = signatureProblem(request.headers?.["x-coinsnap-signature"], rawBody, secret);
  if (problem) {
    logWebhook("security", problem);
    return unauthorized();
  }

  // 2. Only the invoice ID from the body.
  const payload = parseJson(rawBody);
  const invoiceId = typeof payload?.invoiceId === "string" ? payload.invoiceId : "";
  if (!invoiceId) return ok();
  const claimsPaid = payload?.type === "Settled";

  try {
    // 3. Our own record of this invoice: store, Wix transaction, amount, currency.
    const record = await records.get(records.invoiceKey(invoiceId));
    if (!record) {
      // Dashboard test webhooks and other plugins' invoices end here.
      logWebhook("info", "not ours", invoiceId);
      return ok();
    }

    // 4. The invoice as Coinsnap reports it.
    const apiKey = await readSecret(SECRET_API_KEY);
    const api = await coinsnapRequest(
      `api/v1/stores/${encodeURIComponent(record.storeId)}/invoices/${encodeURIComponent(invoiceId)}`,
      apiKey,
      { method: "get" },
    );
    if (api.status >= 500) {
      logWebhook("info", "retry: API unavailable", invoiceId);
      return retryLater();
    }
    if (api.status !== 200) {
      logWebhook("info", "unknown invoice", invoiceId);
      return ok();
    }
    const invoice = await api.json();

    // 5. Decide, then act once.
    const decision = decidePayment(invoice, record, apiKey);
    const paidKey = records.paidKey(record.wixTransactionId);

    if (decision.action === "approve") {
      const first = await records.insertOnce({ _id: paidKey, invoiceId, wixTransactionId: record.wixTransactionId });
      if (!first) {
        const paid = await records.get(paidKey);
        // Another invoice of the same transaction paid it first: the buyer paid twice
        // and the merchant refunds one from Coinsnap. The order itself does not change.
        logWebhook("info", paid?.invoiceId === invoiceId ? "already processed" : "paid twice", invoiceId);
        return ok();
      }
      try {
        await submit(record.wixTransactionId, invoiceId, EVENTS.Settled);
      } catch (error) {
        await records.remove(paidKey); // let Coinsnap's retry try again
        throw error;
      }
      logWebhook("info", "settled", invoiceId);
      return ok();
    }

    if (decision.action === "pending" || decision.action === "cancel") {
      // A paid transaction never moves back, e.g. when a second invoice expires.
      if (await records.get(paidKey)) {
        logWebhook("info", "already processed", invoiceId);
        return ok();
      }
      await submit(record.wixTransactionId, invoiceId, decision.action === "pending" ? EVENTS.Processing : EVENTS.Expired);
      logWebhook("info", decision.reason, invoiceId);
      return ok();
    }

    const forged = claimsPaid && decision.reason !== "not ours";
    logWebhook(forged ? "security" : "info", forged ? "forged status" : decision.reason, invoiceId);
    return ok();
  } catch {
    // API unreachable, secret or collection unavailable, or Wix refused the event.
    logWebhook("info", "retry: processing failed", invoiceId);
    return retryLater();
  }
}
