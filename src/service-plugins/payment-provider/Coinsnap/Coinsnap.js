import { orders } from "wix-ecom-backend";
import { elevate } from "wix-auth";

/**
 * This payment plugin endpoint is triggered when a merchant provides required data to connect their PSP account to a Wix site.
 * The plugin has to verify merchant's credentials, and ensure the merchant has an operational PSP account.
 * @param {import('interfaces-psp-v1-payment-service-provider').ConnectAccountOptions} options
 * @param {import('interfaces-psp-v1-payment-service-provider').Context} context
 * @returns {Promise<import('interfaces-psp-v1-payment-service-provider').ConnectAccountResponse | import('interfaces-psp-v1-payment-service-provider').BusinessError>}
 */
export const connectAccount = async (options, context) => {
  let sUrl = "https://app.coinsnap.io/";
  const response = await fetch(
    sUrl + "api/v1/stores/" + options.credentials.storeId,
    {
      method: "get",
      headers: {
        "X-Api-Key": options.credentials.apiKey,
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  );

  if (!response.ok) {
    return {
      errorCode: response.status,
      errorMessage: "Error during connection with Coinsnap",
      reasonCode: 1002,
    };
  }
  return {
    credentials: options.credentials,
    accountId: "myId",
    accountName: "CoinsnapAccount",
  };
};

/**
 * Creates a payment transaction for a Wix e-commerce order
 *
 * @description
 * This endpoint is critical for processing payments in the Wix payment flow:
 * - Initializes a new payment transaction
 * - Prevents duplicate transactions using `wixTransactionId`
 * - Handles payment creation across different payment providers
 *
 * @workflow
 * 1. Receive payment request from Wix
 * 2. Validate transaction details
 * 3. Create transaction with payment provider
 * 4. Return transaction details or error
 *
 * @security
 * - Ensures idempotency to prevent double-charging
 * - Uses unique transaction identifiers
 * - Validates all incoming payment requests
 *
 * @param {import('interfaces-psp-v1-payment-service-provider').CreateTransactionOptions} options
 * @property {Object} options.order - Complete order information
 * @property {Object} options.merchantCredentials - Payment provider credentials
 * @property {string} options.wixTransactionId - Unique Wix transaction identifier
 *
 * @param {import('interfaces-psp-v1-payment-service-provider').Context} context
 * @property {Object} context.site - Site-specific information
 * @property {string} context.environment - Current execution environment
 *
 * @returns {Promise
 *   import('interfaces-psp-v1-payment-service-provider').CreateTransactionResponse |
 *   import('interfaces-psp-v1-payment-service-provider').BusinessError
 * >} Transaction result or error
 *
 * @example
 * // Successful transaction response
 * {
 *   pluginTransactionId: "coinsnap_invoice_123",
 *   redirectUrl: "https://payment.provider/checkout/abc123"
 * }
 *
 * @example
 * // Error response
 * {
 *   errorCode: "PAYMENT_FAILED",
 *   errorMessage: "Unable to create transaction",
 *   reasonCode: 2001
 * }
 *
 * @throws {BusinessError} When transaction creation fails
 *
 * @see {@link https://dev.wix.com/docs/payment-integration Wix Payment Integration Docs}
 */
export const createTransaction = async (options, context) => {
  const sUrl = "https://app.coinsnap.io/";

  const invoice = {
    currency: options.order.description.currency,
    amount:
      parseInt(options.order.description.totalAmount) /
      Math.pow(10, currencies[options.order.description.currency]),
    redirectUrl: options.order.returnUrls.successUrl,
    redirectAutomatically: true,
    referralCode: "D19987",
    metadata: {
      buyerEmail: options.order.description.billingAddress.email,
      buyerName:
        options.order.description.billingAddress.firstName +
        " " +
        options.order.description.billingAddress.lastName,
      orderId: options.order._id,
      wixTxId: options.wixTransactionId,
      wixAdditionalId: options.merchantCredentials.webhookSecret,
      currency: options.order.description.currency,
    },
  };

  const response = await fetch(
    sUrl + "api/v1/stores/" + options.merchantCredentials.storeId + "/invoices",
    {
      method: "post",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Api-Key": options.merchantCredentials.apiKey,
      },
      body: JSON.stringify(invoice),
    },
  );

  if (!response.ok) {
    return {
      errorCode: response.status,
      errorMessage: `Payment creation failed: ${response.statusText}`,
      reasonCode: 2001,
    };
  }
  const json = await response.json();
  return {
    pluginTransactionId: json.id,
    redirectUrl: json.checkoutLink,
  };
};
export const refundTransaction = async (options, context) => {
  try {
    let refundSession = "";
    return refundSession;
  } catch (error) {
    return error;
  }
};
const currencies = {
  JPY: 0,
  EUR: 2,
  CHF: 2,
  CAD: 2,
  GBP: 2,
  USD: 2,
};
