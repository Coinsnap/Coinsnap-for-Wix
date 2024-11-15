import wixPaymentProviderBackend from "wix-payment-provider-backend";
import { ok, badRequest } from "wix-http-functions";
import { createHmac, timingSafeEqual } from "crypto";

export async function use_post_coinsnap_webhook(request) {
  const req = await request.body.json();

  const validTypes = [
    "InvoiceProcessing",
    "InvoiceSettled",
    "InvoiceExpired",
    "InvoiceInvalid",
  ];
  if (!validTypes.includes(req.type)) { //req.invoiceId.startsWith("test__") || 
    return ok();
  }

  let rawBody = await request.body.text();

  const secret = request.headers["x-coinsnap-sig"].split("=")[1];
  if (!checkSecretKey(req.metadata.wixAdditionalId, rawBody, secret)) {
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

// function checkSecretKey(key, message, signature) {
//   const hmac = createHmac("sha256", key);
//   hmac.update(message);
//   return hmac.digest("hex") === signature;
//   // const hashBytes = hmac.digest();
//   //
//   // let hashString = '';
//   // for (const byte of hashBytes) {
//   //   hashString += ('0' + byte.toString(16)).slice(-2);
//   // }
//   //
//   // return hashString === signature;
// }
function checkSecretKey(key, message, signature) {
  // Input validation
  if (!key || !message || !signature) {
    console.warn("Invalid input: Missing key, message, or signature");
    return false;
  }

  // Validate input types
  if (
    typeof key !== "string" ||
    typeof message !== "string" ||
    typeof signature !== "string"
  ) {
    console.warn("Invalid input types");
    return false;
  }

  // Create HMAC
  const hmac = createHmac("sha256", key);
  hmac.update(message);

  // Generate digest
  const calculatedSignature = hmac.digest("hex");

  // Timing-safe comparison
  const calculatedBuffer = Buffer.from(calculatedSignature);
  const providedBuffer = Buffer.from(signature);

  // Check length first to prevent unnecessary timing-safe comparison
  if (calculatedBuffer.length !== providedBuffer.length) {
    return false;
  }

  // Use timingSafeEqual for constant-time comparison
  return timingSafeEqual(calculatedBuffer, providedBuffer);
}