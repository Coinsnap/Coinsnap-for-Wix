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
<<<<<<< HEAD
  let returnObj = {
    credentials: options.credentials,
  };
  const response = await fetch(
    sUrl + "api/v1/stores/" + options.credentials.storeId,
    {
        method: "get",
        headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-api-key': options.credentials.apiKey
        },
=======
  const response = await fetch(
    sUrl + "api/v1/stores/" + options.credentials.storeId,
    {
      method: "get",
      headers: {
        "X-Api-Key": options.credentials.apiKey,
        "Content-Type": "application/json; charset=utf-8",
      },
>>>>>>> fix-issues
    },
  );

  if (response.status == 200) {
    returnObj.accountId = "myId";
    returnObj.accountName = "CoinsnapAccount";
  } else {
    returnObj.errorCode = response.status;
    returnObj.errorMessage = "Error during connection with Coinsnap";
    returnObj.reasonCode = 1002;
  }
  return returnObj;
};

/**
 * This payment plugin endpoint is triggered when a buyer pays on a Wix site.
 * The plugin has to process this payment request but prevent double payments for the same `wixTransactionId`.
 * @param {import('interfaces-psp-v1-payment-service-provider').CreateTransactionOptions} options
 * @param {import('interfaces-psp-v1-payment-service-provider').Context} context
 * @returns {Promise<import('interfaces-psp-v1-payment-service-provider').CreateTransactionResponse | import('interfaces-psp-v1-payment-service-provider').BusinessError>}
 */
export const createTransaction = async (options, context) => {
<<<<<<< HEAD
    let sUrl = "https://app.coinsnap.io/";

    const invoice = {
        currency: options.order.description.currency,
        amount: parseInt(options.order.description.totalAmount) / Math.pow(10, currencies[options.order.description.currency]),
        redirectUrl: options.order.returnUrls.successUrl,
        redirectAutomatically: true,
        orderId: options.order._id,
        buyerEmail: options.order.description.billingAddress.email,
        referralCode: 'D19987',
        metadata: {
            customerName: options.order.description.billingAddress.firstName + " " + options.order.description.billingAddress.lastName,
            orderNumber: options.order._id,
            wixTransactionID: options.wixTransactionId,
        },
    };

    const response = await fetch(
        sUrl + "api/v1/stores/" + options.merchantCredentials.storeId + "/invoices",
        {
            method: "post",
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json',
                'x-api-key': options.merchantCredentials.apiKey
            },
            body: JSON.stringify(invoice),
        },
    );
=======
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
>>>>>>> fix-issues

    if (response.status == 200) {
        const json = await response.json();
        return {
          pluginTransactionId: json.id,
          redirectUrl: json.checkoutLink,
        };
  } else {
    return {
      errorCode: response.status,
      errorMessage: "Error Coinsnap payment",
      reasonCode: 2001,
    };
  }
};

export const refundTransaction = async (options, context) => {  
  try {
    let refundSession = '';
    return refundSession;
  } catch (error) {
    return error;
  }
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