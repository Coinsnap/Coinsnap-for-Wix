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

// Adds a key only when it has a value: no empty strings or nulls in the invoice.
function put(target, key, value) {
  const v = typeof value === "string" ? value.trim() : value;
  if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) return;
  if (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0) return;
  target[key] = v;
}

// Wix sends amounts in minor units as strings; null for anything that is not one.
function money(minor, exponent) {
  if (!/^-?\d+$/.test(String(minor ?? ""))) return null;
  const n = BigInt(minor);
  const value = minorToDecimal(n < 0n ? -n : n, exponent);
  return n < 0n ? `-${value}` : value;
}

function fullName(address) {
  return [address?.firstName, address?.lastName].filter((p) => typeof p === "string" && p.trim()).map((p) => p.trim()).join(" ");
}

function addressLine(address) {
  if (typeof address?.address === "string" && address.address.trim()) return address.address;
  return [address?.street, address?.houseNumber].filter((p) => typeof p === "string" && p.trim()).join(" ");
}

function addressFields(address) {
  const out = {};
  put(out, "name", fullName(address));
  put(out, "company", address?.company);
  put(out, "address1", addressLine(address));
  put(out, "city", address?.city);
  put(out, "zip", address?.zipCode);
  put(out, "state", address?.state);
  put(out, "country", address?.countryCode);
  put(out, "phone", address?.phone);
  return out;
}

// Everything Wix gives the payment provider about the order. This plugin has no
// customer-data setting, so buyer data is always sent (and shown to the merchant in
// Coinsnap). The keys the webhook checks are set separately and never overwritten.
export function orderMetadata(order, exponent) {
  const description = order?.description ?? {};
  const billing = description.billingAddress ?? {};
  const meta = {};
  put(meta, "platform", "wix");
  put(meta, "orderId", order?._id);
  put(meta, "orderNumber", order?._id);

  const name = fullName(billing);
  put(meta, "customerName", name);
  put(meta, "buyerName", name);
  put(meta, "buyerEmail", billing.email);
  put(meta, "buyerPhone", billing.phone);
  put(meta, "buyerCompany", billing.company);
  put(meta, "buyerAddress1", addressLine(billing));
  put(meta, "buyerCity", billing.city);
  put(meta, "buyerZip", billing.zipCode);
  put(meta, "buyerState", billing.state);
  put(meta, "buyerCountry", billing.countryCode);
  put(meta, "shippingAddress", addressFields(description.shippingAddress));
  put(meta, "buyerId", description.buyerInfo?.buyerId);
  put(meta, "language", description.buyerInfo?.buyerLanguage);

  const items = Array.isArray(description.items) ? description.items : [];
  const lineItems = items.map((item) => {
    const quantity = Number.isInteger(item?.quantity) ? item.quantity : 1;
    const line = {};
    put(line, "name", item?.name);
    put(line, "productId", item?._id ?? item?.id);
    line.quantity = quantity;
    put(line, "price", money(item?.price, exponent));
    const price = /^-?\d+$/.test(String(item?.price ?? "")) ? BigInt(item.price) : null;
    if (price !== null) put(line, "total", money(price * BigInt(quantity), exponent));
    put(line, "description", item?.description);
    put(line, "category", item?.category);
    if (item?.donation === true) line.donation = true;
    return line;
  });
  put(meta, "lineItems", lineItems);
  if (items.length === 1) put(meta, "itemCode", items[0]?._id ?? items[0]?.id);
  const summary = lineItems.filter((l) => l.name).map((l) => `${l.quantity}x ${l.name}`).join(", ");
  put(meta, "itemDesc", summary.length > 250 ? `${summary.slice(0, 247)}...` : summary);

  put(meta, "taxTotal", money(description.charges?.tax, exponent));
  put(meta, "shippingTotal", money(description.charges?.shipping, exponent));
  put(meta, "discountTotal", money(description.charges?.discount, exponent));
  return meta;
}

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

  let details = {};
  try {
    details = orderMetadata(options.order, exponent);
  } catch {
    // Extra order details must never stop the payment.
    details = {};
  }

  const invoice = {
    currency,
    amount: Number(minorToDecimal(amountMinor, exponent)),
    redirectUrl: returnUrls.successUrl,
    orderId,
    buyerEmail: billing.email,
    referralCode: "D19987",
    metadata: {
      ...details,
      // The webhook matches on these: set last so nothing above can change them.
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
