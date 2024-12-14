import wixPaymentProviderBackend from "wix-payment-provider-backend";
import { ok, badRequest } from "wix-http-functions";
import { createHmac, timingSafeEqual } from "crypto";

export async function use_post_coinsnapWebhook(request) {
  const rawBody = await request.body.text();
  const req = JSON.parse(rawBody);

  const validTypes = [
    "Processing",
    "Settled",
    "Expired",
    //"New"
  ];
  if (!validTypes.includes(req.type)) {
    return ok();
  }

  let secret = request.headers["x-coinsnap-sig"];
  if (!secret || !secret.startsWith("sha256=")) {
    console.warn("Invalid or missing signature header");
    return badRequest();
  }
  else {
     secret = secret.split("=")[1];
  }

  if (!checkSecretKey(req.metadata.wixAdditionalID, rawBody, secret)) {
    return badRequest();
  }

  var trx = {
    wixTransactionId: req.metadata.wixTransactionID,
    pluginTransactionId: req.invoiceId,
  };

  switch (req.type) {
    case "Processing":
    case "Settled":
      trx.reasonCode = 5009;
      console.log('Transaction settled: '+ trx.wixTransactionId + ' / ' + trx.pluginTransactionId);
      break;
    case "Expired":
      trx.reasonCode = 3035;
      trx.errorCode = "Expired";
      trx.errorMessage = "An invoice expired";
      break;
    case "New":
      console.log('New transaction: '+ trx.wixTransactionId + ' / ' + trx.pluginTransactionId);
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
   
  // Check parameters
  if (!key || !message || !signature) {
    console.warn("Invalid input: Missing key, message, or signature");
    return false;
  }

  // Check parameters type
  if (typeof key !== "string" || typeof message !== "string" || typeof signature !== "string") {
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
    console.warn("Check sums don't match");
    return false;
  }
  
  // Use timingSafeEqual for constant-time comparison
  if(!timingSafeEqual(calculatedBuffer, providedBuffer)){
    console.warn("Constant-time comparison is failed");
    return false;
  }
  
  return true;
}