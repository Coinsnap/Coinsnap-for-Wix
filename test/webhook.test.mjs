import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { state } from "./stubs/state.mjs";
import { use_post_coinsnapWebhook } from "../src/http-functions.js";
import { createTransaction, connectAccount } from "../src/service-plugins/payment-provider/Coinsnap/Coinsnap.js";
import { decidePayment, signatureProblem, transactionTag, RECORDS } from "../src/coinsnap.js";

const SECRET = "whsec_test_secret";
const API_KEY = "api_key_test_1234";
const STORE = "STORE_ID_SHOULD_NOT_BE_LOGGED";
const TX = "wix-tx-1";

let logs = [];
let invoices = {}; // invoiceId -> invoice the fake API returns
let apiStatus = null; // force an HTTP status from the fake API

function sign(body, secret = SECRET, t = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

function request(bodyObj, header) {
  const body = typeof bodyObj === "string" ? bodyObj : JSON.stringify(bodyObj);
  return {
    headers: header === undefined ? { "x-coinsnap-signature": sign(body) } : header === null ? {} : { "x-coinsnap-signature": header },
    body: { text: async () => body },
  };
}

function fakeApi(url, init) {
  assert.equal(init.headers["x-api-key"], API_KEY);
  if (apiStatus === "throw") throw new Error(`connect ECONNREFUSED ${url}`);
  if (apiStatus) return { status: apiStatus, json: async () => ({}) };
  const m = url.match(/\/stores\/([^/]+)\/invoices\/([^/]+)$/);
  if (m) {
    assert.equal(decodeURIComponent(m[1]), STORE, "store ID comes from our record");
    const inv = invoices[decodeURIComponent(m[2])];
    return inv ? { status: 200, json: async () => inv } : { status: 400, json: async () => ({}) };
  }
  if (/\/stores\/[^/]+\/invoices$/.test(url)) {
    const id = `inv_${Object.keys(invoices).length + 1}`;
    const sent = JSON.parse(init.body);
    invoices[id] = { id, status: "New", currency: sent.currency, invoiceAmount: sent.amount, amount: 1234, metadata: sent.metadata };
    return { status: 200, json: async () => ({ id, checkoutLink: `https://app.coinsnap.io/i/${id}` }) };
  }
  if (/\/stores\/[^/]+$/.test(url)) return { status: 200, json: async () => ({}) };
  return { status: 404, json: async () => ({}) };
}

async function checkout({ total = "1999", currency = "EUR", tx = TX } = {}) {
  const res = await createTransaction(
    {
      wixTransactionId: tx,
      order: {
        _id: "order-1",
        returnUrls: { successUrl: "https://shop.example/thank-you" },
        description: { currency, totalAmount: total, billingAddress: { email: "buyer@example.com", firstName: "Ann", lastName: "Buyer" } },
      },
      merchantCredentials: { storeId: STORE, apiKey: API_KEY },
    },
    {},
  );
  return res;
}

beforeEach(() => {
  state.reset();
  state.secrets = { COINSNAP_API_KEY: API_KEY, COINSNAP_WEBHOOK_SECRET: SECRET };
  state.fetch = fakeApi;
  invoices = {};
  apiStatus = null;
  logs = [];
  for (const level of ["log", "info", "warn", "error"]) console[level] = (...a) => logs.push(`${level}: ${a.join(" ")}`);
});

const settle = (id, patch = {}) => Object.assign(invoices[id], { status: "Settled" }, patch);
const security = () => logs.filter((l) => l.includes("SECURITY"));

// --- signature -------------------------------------------------------------

test("missing, wrong and stale signatures get 401 and change nothing", async () => {
  const { pluginTransactionId: id } = await checkout();
  settle(id);
  const body = { type: "Settled", invoiceId: id };
  const old = Math.floor(Date.now() / 1000) - 600;
  for (const [header, reason] of [
    [null, "bad signature"],
    ["t=1,v1=deadbeef", "bad signature"],
    [sign(JSON.stringify(body), "other-secret"), "bad signature"],
    [sign(JSON.stringify(body), SECRET, old), "stale timestamp"],
  ]) {
    logs = [];
    const res = await use_post_coinsnapWebhook(request(body, header));
    assert.equal(res.status, 401);
    assert.match(security().join(), new RegExp(reason));
  }
  assert.equal(state.events.length, 0);
});

test("an empty or missing webhook secret rejects even a webhook signed with an empty key", async () => {
  const { pluginTransactionId: id } = await checkout();
  settle(id);
  const body = JSON.stringify({ type: "Settled", invoiceId: id });
  state.secrets.COINSNAP_WEBHOOK_SECRET = "";
  assert.equal((await use_post_coinsnapWebhook(request(body, sign(body, "")))).status, 401);
  delete state.secrets.COINSNAP_WEBHOOK_SECRET;
  assert.equal((await use_post_coinsnapWebhook(request(body, sign(body, "")))).status, 401);
  assert.equal(state.events.length, 0);
});

test("signatureProblem: body change breaks the signature", () => {
  const h = sign("a");
  assert.equal(signatureProblem(h, "a", SECRET), null);
  assert.equal(signatureProblem(h, "b", SECRET), "bad signature");
  assert.equal(signatureProblem("v1=abc", "a", SECRET), "bad signature");
});

// --- decide from the API ---------------------------------------------------

test("a signed dashboard test webhook with a made-up invoice ID changes nothing and replies 200", async () => {
  const res = await use_post_coinsnapWebhook(request({ type: "Settled", invoiceId: "test_123", metadata: { orderId: 42 } }));
  assert.equal(res.status, 200);
  assert.equal(state.events.length, 0);
  assert.equal(security().length, 0);
  assert.match(logs.join(), /INFO webhook reason=not ours invoice=test_123/);
});

test("a Settled body for an invoice the API reports as New is ignored and logged as forged", async () => {
  const { pluginTransactionId: id } = await checkout();
  const res = await use_post_coinsnapWebhook(
    request({ type: "Settled", invoiceId: id, status: "Settled", metadata: { wixTransactionID: "other" } }),
  );
  assert.equal(res.status, 200);
  assert.equal(state.events.length, 0);
  assert.match(security().join(), /forged status/);
});

test("API 5xx and network errors reply 503; an unknown invoice replies 200", async () => {
  const { pluginTransactionId: id } = await checkout();
  apiStatus = 502;
  assert.equal((await use_post_coinsnapWebhook(request({ invoiceId: id }))).status, 503);
  apiStatus = "throw";
  assert.equal((await use_post_coinsnapWebhook(request({ invoiceId: id }))).status, 503);
  apiStatus = 400;
  assert.equal((await use_post_coinsnapWebhook(request({ invoiceId: id }))).status, 200);
  assert.equal(state.events.length, 0);
});

// --- what was paid ---------------------------------------------------------

test("a real Settled payment approves the Wix transaction once, even when the webhook repeats", async () => {
  const { pluginTransactionId: id } = await checkout();
  settle(id);
  for (let i = 0; i < 3; i++) assert.equal((await use_post_coinsnapWebhook(request({ type: "Settled", invoiceId: id }))).status, 200);
  assert.deepEqual(state.events, [{ wixTransactionId: TX, pluginTransactionId: id }]);
  assert.match(logs.join(), /already processed/);
});

test("an underpaid or wrong-currency invoice leaves the transaction unapproved", async () => {
  const { pluginTransactionId: a } = await checkout();
  settle(a, { invoiceAmount: 0.01 });
  const { pluginTransactionId: b } = await checkout({ tx: "wix-tx-2" });
  settle(b, { currency: "USD" });
  await use_post_coinsnapWebhook(request({ type: "Settled", invoiceId: a }));
  await use_post_coinsnapWebhook(request({ type: "Settled", invoiceId: b }));
  assert.equal(state.events.length, 0);
  assert.equal(security().filter((l) => l.includes("forged status")).length, 2);
});

test("an edited record (cheaper amount or another transaction) does not approve", async () => {
  const { pluginTransactionId: cheap } = await checkout({ total: "1", tx: "wix-tx-cheap" });
  settle(cheap);
  const rec = state.data.get(`${RECORDS}/inv-${cheap}`);
  rec.wixTransactionId = TX; // someone with write access to the collection redirects it
  await use_post_coinsnapWebhook(request({ type: "Settled", invoiceId: cheap }));
  assert.equal(state.events.length, 0);
});

test("two invoices for one transaction: paying the first approves; the second expiring does not cancel", async () => {
  const { pluginTransactionId: first } = await checkout();
  const { pluginTransactionId: second } = await checkout();
  settle(first);
  invoices[second].status = "Expired";
  await use_post_coinsnapWebhook(request({ type: "Settled", invoiceId: first }));
  await use_post_coinsnapWebhook(request({ type: "Expired", invoiceId: second }));
  await use_post_coinsnapWebhook(request({ type: "Processing", invoiceId: second }));
  assert.deepEqual(state.events, [{ wixTransactionId: TX, pluginTransactionId: first }]);
});

test("Processing is reported as pending and Expired as canceled while unpaid", async () => {
  const { pluginTransactionId: id } = await checkout();
  invoices[id].status = "Processing";
  await use_post_coinsnapWebhook(request({ type: "Processing", invoiceId: id }));
  invoices[id].status = "Expired";
  await use_post_coinsnapWebhook(request({ type: "Expired", invoiceId: id }));
  invoices[id].status = "Invalid";
  await use_post_coinsnapWebhook(request({ type: "Invalid", invoiceId: id }));
  assert.equal(state.events.length, 2);
  assert.equal(state.events[0].reasonCode, 5005);
  assert.equal(state.events[1].reasonCode, 3030);
});

test("if Wix refuses the approval, the webhook replies 503 and the retry approves", async () => {
  const { pluginTransactionId: id } = await checkout();
  settle(id);
  state.submitError = new Error("wix down");
  assert.equal((await use_post_coinsnapWebhook(request({ invoiceId: id }))).status, 503);
  state.submitError = null;
  assert.equal((await use_post_coinsnapWebhook(request({ invoiceId: id }))).status, 200);
  assert.equal(state.events.length, 1);
});

test("decidePayment: overpaid counts, one minor unit of rounding is allowed, zero never pays", () => {
  const rec = { invoiceId: "i", wixTransactionId: "t", amountMinor: "1999", currency: "EUR" };
  const inv = (patch) => ({
    id: "i",
    status: "Settled",
    currency: "EUR",
    invoiceAmount: 19.99,
    metadata: { wixTransactionID: "t", wixTag: transactionTag(API_KEY, "t", rec.amountMinor, "EUR") },
    ...patch,
  });
  assert.equal(decidePayment(inv({ additionalStatus: "Overpaid" }), rec, API_KEY).action, "approve");
  assert.equal(decidePayment(inv({ invoiceAmount: "19.98" }), rec, API_KEY).action, "approve");
  assert.equal(decidePayment(inv({ invoiceAmount: 19.97 }), rec, API_KEY).action, "ignore");
  assert.equal(decidePayment(inv({ invoiceAmount: undefined, fiatAmount: 19.99 }), rec, API_KEY).action, "approve");
  assert.equal(decidePayment(inv({ invoiceAmount: undefined }), rec, API_KEY).action, "ignore");
  assert.equal(decidePayment(inv({}), rec, "another-key").reason, "not ours");
  const zero = { ...rec, amountMinor: "0" };
  const zeroInv = inv({ invoiceAmount: 0, metadata: { wixTransactionID: "t", wixTag: transactionTag(API_KEY, "t", "0", "EUR") } });
  assert.equal(decidePayment(zeroInv, zero, API_KEY).action, "ignore");
});

// --- checkout and logs -----------------------------------------------------

test("checkout records the invoice with Wix's amount and currency; zero totals are refused", async () => {
  const res = await checkout({ total: "1000", currency: "jpy" });
  const rec = state.data.get(`${RECORDS}/inv-${res.pluginTransactionId}`);
  assert.deepEqual(
    { amountMinor: rec.amountMinor, currency: rec.currency, wixTransactionId: rec.wixTransactionId, storeId: rec.storeId },
    { amountMinor: "1000", currency: "JPY", wixTransactionId: TX, storeId: STORE },
  );
  assert.equal(invoices[res.pluginTransactionId].invoiceAmount, 1000);
  assert.equal(invoices[res.pluginTransactionId].metadata.wixStoreId, undefined);
  assert.equal((await checkout({ total: "0" })).errorCode, "INVALID_AMOUNT");
});

test("checkout API errors return a fixed message without the store ID", async () => {
  apiStatus = "throw";
  const res = await checkout();
  assert.equal(res.errorMessage, "Error Coinsnap payment");
  assert.ok(!JSON.stringify(res).includes(STORE));
});

test("connecting fails without the webhook secret", async () => {
  delete state.secrets.COINSNAP_WEBHOOK_SECRET;
  const res = await connectAccount({ credentials: { storeId: STORE, apiKey: API_KEY } }, {});
  assert.equal(res.errorCode, "SECRETS_MISSING");
  state.secrets.COINSNAP_WEBHOOK_SECRET = SECRET;
  const ok = await connectAccount({ credentials: { storeId: STORE, apiKey: API_KEY } }, {});
  assert.equal(ok.accountId, STORE);
});

test("logs never contain secrets, signature headers, the store ID or customer data", async () => {
  const { pluginTransactionId: id } = await checkout();
  settle(id);
  const body = { invoiceId: id };
  await use_post_coinsnapWebhook(request(body, "t=1,v1=bad"));
  apiStatus = 500;
  await use_post_coinsnapWebhook(request(body));
  apiStatus = null;
  await use_post_coinsnapWebhook(request(body));
  await use_post_coinsnapWebhook(request({ invoiceId: "<script>../x" }));
  const all = logs.join("\n");
  assert.ok(logs.length >= 4);
  for (const s of [SECRET, API_KEY, STORE, "buyer@example.com", "Ann", "v1=", "<script>"]) assert.ok(!all.includes(s), s);
});

// --- invoice request: orderId and order metadata -----------------------------

test("checkout sends the Wix order ID, buyer details and line items to Coinsnap", async () => {
  let sent;
  state.fetch = (url, init) => {
    if (/\/invoices$/.test(url)) sent = JSON.parse(init.body);
    return fakeApi(url, init);
  };
  const { pluginTransactionId: id } = await createTransaction(
    {
      wixTransactionId: TX,
      order: {
        _id: "order-1",
        returnUrls: { successUrl: "https://shop.example/thank-you" },
        description: {
          currency: "EUR",
          totalAmount: "2599",
          items: [
            { _id: "item-a", name: "Camera", quantity: 1, price: "1999", description: "Portable camera", category: "PHYSICAL" },
            { _id: "item-b", name: "Strap", quantity: 2, price: "250" },
          ],
          charges: { tax: "300", shipping: "100", discount: "0" },
          billingAddress: {
            email: "buyer@example.com", firstName: "Ann", lastName: "Buyer", company: "ACME", phone: "+49 30 1234",
            street: "Main St", houseNumber: "1", city: "Berlin", zipCode: "10115", state: "BE", countryCode: "DE",
          },
          shippingAddress: { firstName: "Bob", lastName: "Receiver", address: "Side St 2", city: "Hamburg", zipCode: "20095", countryCode: "DE" },
          buyerInfo: { buyerId: "buyer-guid", buyerLanguage: "de" },
        },
      },
      merchantCredentials: { storeId: STORE, apiKey: API_KEY },
    },
    {},
  );
  assert.equal(sent.orderId, "order-1");
  assert.equal(sent.buyerEmail, "buyer@example.com");
  const m = sent.metadata;
  assert.equal(m.orderId, "order-1");
  assert.equal(m.orderNumber, "order-1");
  assert.equal(m.platform, "wix");
  assert.equal(m.customerName, "Ann Buyer");
  assert.equal(m.buyerName, "Ann Buyer");
  assert.equal(m.buyerEmail, "buyer@example.com");
  assert.equal(m.buyerPhone, "+49 30 1234");
  assert.equal(m.buyerCompany, "ACME");
  assert.equal(m.buyerAddress1, "Main St 1");
  assert.deepEqual([m.buyerCity, m.buyerZip, m.buyerState, m.buyerCountry], ["Berlin", "10115", "BE", "DE"]);
  assert.deepEqual(m.shippingAddress, { name: "Bob Receiver", address1: "Side St 2", city: "Hamburg", zip: "20095", country: "DE" });
  assert.equal(m.buyerId, "buyer-guid");
  assert.equal(m.language, "de");
  assert.deepEqual(m.lineItems, [
    { name: "Camera", productId: "item-a", quantity: 1, price: "19.99", total: "19.99", description: "Portable camera", category: "PHYSICAL" },
    { name: "Strap", productId: "item-b", quantity: 2, price: "2.50", total: "5.00" },
  ]);
  assert.equal(m.itemDesc, "1x Camera, 2x Strap");
  assert.deepEqual([m.taxTotal, m.shippingTotal, m.discountTotal], ["3.00", "1.00", "0.00"]);
  assert.equal(m.itemCode, undefined, "itemCode only for a single product");
  for (const v of Object.values(m)) assert.ok(v !== "" && v !== null && v !== undefined);
  // The keys the webhook checks are unchanged, and the invoice still approves the transaction.
  assert.equal(m.wixTransactionID, TX);
  assert.equal(m.wixTag, transactionTag(API_KEY, TX, "2599", "EUR"));
  assert.equal(m.currency, "EUR");
  settle(id);
  const res = await use_post_coinsnapWebhook(request({ type: "Settled", invoiceId: id }));
  assert.equal(res.status, 200);
  assert.equal(state.events.length, 1);
  for (const pii of ["buyer@example.com", "Ann Buyer", "Main St", "+49 30"]) assert.ok(!logs.join("\n").includes(pii), `${pii} not logged`);
});

test("order details cannot override the keys the webhook matches on", async () => {
  let sent;
  state.fetch = (url, init) => {
    if (/\/invoices$/.test(url)) sent = JSON.parse(init.body);
    return fakeApi(url, init);
  };
  await checkout();
  assert.equal(sent.metadata.orderNumber, "order-1");
  assert.equal(sent.metadata.wixTransactionID, TX);
  assert.equal(sent.metadata.customerName, "Ann Buyer");
  assert.equal(sent.metadata.lineItems, undefined, "no items, no empty array");
});
