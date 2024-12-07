import { orders } from "wix-ecom-backend";
import { elevate } from "wix-auth";

export const connectAccount = async (options, context) => {
  let sUrl = "https://app.coinsnap.io/";
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

export const createTransaction = async (options, context) => {
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

const currencies = {
  JPY: 0,
  EUR: 2,
  CHF: 2,
  CAD: 2,
  GBP: 2,
  USD: 2,
};