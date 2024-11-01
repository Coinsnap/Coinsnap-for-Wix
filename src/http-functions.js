import wixPaymentProviderBackend from "wix-payment-provider-backend";
import { ok, badRequest } from "wix-http-functions";
import { createHmac } from "crypto";

// An endpoint for receiving updates about transactions.
export async function postCoinsnapWebhook(request) {
  const req = await request.body.json();

  const validTypes = [
    "InvoiceProcessing",
    "InvoiceSettled",
    "InvoiceReceivedPayment",
    "InvoicePaymentSettled",
    "InvoiceExpired",
    "InvoiceInvalid",
  ];
  if (req.invoiceId.startsWith("test__") || !validTypes.includes(req.type)) {
    return ok();
  }

  let rawBody = await request.body.text();

  const headerBtcPaySecret = request.headers["x-coinsnap-sig"].split("=")[1];
  if (
    !checkSecretKey(req.metadata.wixAdditionalId, rawBody, headerBtcPaySecret)
  ) {
    return badRequest();
  }

  var trx = {
    wixTransactionId: req.metadata.wixTxId,
    pluginTransactionId: req.invoiceId + "|" + req.metadata.currency,
  };

  switch (req.type) {
    case "InvoiceProcessing":
    case "InvoiceSettled":
      trx.reasonCode = 5009;
      break;
    case "InvoiceExpired":
      trx.reasonCode = 3035;
      trx.errorCode = "Expired";
      trx.errorMessage = "An invoice expired";
      break;
    case "InvoiceInvalid":
      trx.reasonCode = 3000;
      trx.errorCode = "Invalid";
      trx.errorMessage = "An invoice became invalid";
      break;
  }

  await wixPaymentProviderBackend.submitEvent({
    event: {
      transaction: trx,
    },
  });
  return ok();
}

function checkSecretKey(key, message, signature) {
  const hmac = createHmac("sha256", key);
  hmac.update(message);
  return hmac.digest("hex") === signature;
  // const hashBytes = hmac.digest();
  //
  // let hashString = '';
  // for (const byte of hashBytes) {
  //   hashString += ('0' + byte.toString(16)).slice(-2);
  // }
  //
  // return hashString === signature;
}
