import {
  SECRET_API_KEY,
  coinsnapRequest,
  currencyExponent,
  minorToDecimal,
  readSecret,
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

  // The webhook reads the key from the Secrets Manager, so a missing or different
  // one would only show up as orders that never get marked paid.
  try {
    const secretApiKey = await readSecret(SECRET_API_KEY);
    if (!safeEqual(secretApiKey, apiKey)) {
      return failure("API_KEY_MISMATCH", `${SECRET_API_KEY} does not match the API key entered here`);
    }
  } catch (error) {
    return failure("SECRETS_MISSING", error.message);
  }

  const response = await coinsnapRequest(`api/v1/stores/${storeId}`, apiKey, { method: "get" });
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
      wixStoreId: storeId,
      wixTag: transactionTag(apiKey, options.wixTransactionId, amountMinor, currency),
      currency,
    },
  };

  const response = await coinsnapRequest(`api/v1/stores/${storeId}/invoices`, apiKey, {
    method: "post",
    body: JSON.stringify(invoice),
  });

  if (response.status !== 200) {
    return {
      errorCode: response.status,
      errorMessage: "Error Coinsnap payment",
      reasonCode: 2001,
    };
  }
  const json = await response.json();
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
