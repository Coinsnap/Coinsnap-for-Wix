import {
  SECRET_API_KEY,
  SECRET_WEBHOOK,
  coinsnapRequest,
  currencyExponent,
  minorToDecimal,
  readSecret,
  records,
  safeEqual,
  transactionTag,
} from "backend/coinsnap";

/**
 * This payment plugin endpoint is triggered when a merchant provides required data to connect their PSP account to a Wix site.
 * The plugin has to verify merchant's credentials, and ensure the merchant has an operational PSP account.
 * @param {import('interfaces-psp-v1-payment-service-provider').ConnectAccountOptions} options
 * @param {import('interfaces-psp-v1-payment-service-provider').Context} context
 * @returns {Promise<import('interfaces-psp-v1-payment-service-provider').ConnectAccountResponse | import('interfaces-psp-v1-payment-service-provider').BusinessError>}
 */
export const connectAccount = async (options, context) => {
  const { storeId, apiKey } = options.credentials;
  const failure = (errorCode, errorMessage) => ({
    credentials: options.credentials,
    errorCode,
    errorMessage,
    reasonCode: 1002,
  });

  // The webhook reads the key and its signing secret from the Secrets Manager and
  // keeps its records in a CMS collection, so a missing piece would only show up as
  // orders that never get marked paid.
  try {
    const secretApiKey = await readSecret(SECRET_API_KEY);
    if (!safeEqual(secretApiKey, apiKey)) {
      return failure("API_KEY_MISMATCH", `${SECRET_API_KEY} does not match the API key entered here`);
    }
    await readSecret(SECRET_WEBHOOK);
  } catch (error) {
    return failure("SECRETS_MISSING", error.message);
  }
  try {
    await records.get(records.invoiceKey("connection-check"));
  } catch {
    return failure("COLLECTION_MISSING", "The CoinsnapInvoices collection is missing or not readable");
  }

  let response;
  try {
    response = await coinsnapRequest(`api/v1/stores/${encodeURIComponent(storeId)}`, apiKey, { method: "get" });
  } catch {
    return failure("CONNECTION_FAILED", "Error during connection with Coinsnap");
  }
  if (response.status !== 200) {
    return failure(response.status, "Error during connection with Coinsnap");
  }
  return {
    credentials: options.credentials,
    accountId: storeId,
    accountName: "Coinsnap",
  };
};

/**
 * This payment plugin endpoint is triggered when a buyer pays on a Wix site.
 * The plugin has to process this payment request but prevent double payments for the same `wixTransactionId`.
 * @param {import('interfaces-psp-v1-payment-service-provider').CreateTransactionOptions} options
 * @param {import('interfaces-psp-v1-payment-service-provider').Context} context
 * @returns {Promise<import('interfaces-psp-v1-payment-service-provider').CreateTransactionResponse | import('interfaces-psp-v1-payment-service-provider').BusinessError>}
 */
export const createTransaction = async (options, context) => {
  const { description, returnUrls, _id: orderId } = options.order;
  const { storeId, apiKey } = options.merchantCredentials;
  const currency = String(description.currency).toUpperCase();
  const amountMinor = String(BigInt(description.totalAmount));
  const billing = description.billingAddress ?? {};
  const exponent = currencyExponent(currency);
  if (exponent === null) {
    return { errorCode: "UNSUPPORTED_CURRENCY", errorMessage: `Unsupported currency ${currency}`, reasonCode: 2001 };
  }
  if (BigInt(amountMinor) <= 0n) {
    return { errorCode: "INVALID_AMOUNT", errorMessage: "The order total must be above zero", reasonCode: 2001 };
  }
  const paymentFailed = { errorCode: "PAYMENT_FAILED", errorMessage: "Error Coinsnap payment", reasonCode: 2001 };

  const invoice = {
    currency,
    amount: Number(minorToDecimal(amountMinor, exponent)),
    redirectUrl: returnUrls.successUrl,
    orderId,
    buyerEmail: billing.email,
    referralCode: "D19987",
    metadata: {
      customerName: [billing.firstName, billing.lastName].filter(Boolean).join(" "),
      orderNumber: orderId,
      wixTransactionID: options.wixTransactionId,
      wixTag: transactionTag(apiKey, options.wixTransactionId, amountMinor, currency),
      currency,
    },
  };

  let json;
  try {
    const response = await coinsnapRequest(`api/v1/stores/${encodeURIComponent(storeId)}/invoices`, apiKey, {
      method: "post",
      body: JSON.stringify(invoice),
    });
    if (response.status !== 200) {
      return { ...paymentFailed, errorCode: response.status };
    }
    json = await response.json();
    if (typeof json?.id !== "string" || typeof json?.checkoutLink !== "string") return paymentFailed;

    // The webhook decides from this record, never from the notification (guide 6.7, 6.9).
    // Every invoice of a transaction gets its own record, so a retried checkout still
    // lets the buyer pay the first one.
    await records.insertOnce({
      _id: records.invoiceKey(json.id),
      invoiceId: json.id,
      wixTransactionId: options.wixTransactionId,
      storeId,
      amountMinor,
      currency,
    });
  } catch {
    return paymentFailed;
  }
  return {
    pluginTransactionId: json.id,
    redirectUrl: json.checkoutLink,
  };
};

// Refunds are not supported through Wix; the merchant refunds from Coinsnap.
// Shaped like Wix's failed-refund example, which carries a pluginRefundId.
export const refundTransaction = async (options, context) => ({
  pluginRefundId: `coinsnap-refund-unsupported-${options.wixRefundId}`,
  reasonCode: 3025,
  errorCode: "REFUND_NOT_SUPPORTED",
  errorMessage: "Refunds for Bitcoin payments are handled in your Coinsnap account.",
});
