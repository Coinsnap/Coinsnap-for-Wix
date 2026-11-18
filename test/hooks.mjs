// Resolves the Wix-only module names used by src/ to local stubs, so the backend
// code runs unchanged under plain Node.
const map = {
  "wix-secrets-backend.v2": "./stubs/wix.mjs",
  "wix-data": "./stubs/wix-data.mjs",
  "wix-auth": "./stubs/wix.mjs",
  "wix-fetch": "./stubs/wix.mjs",
  "wix-http-functions": "./stubs/wix.mjs",
  "wix-payment-provider-backend": "./stubs/wix-payment-provider-backend.mjs",
  "backend/coinsnap": "../src/coinsnap.js",
};
export async function resolve(specifier, context, next) {
  if (map[specifier]) return next(new URL(map[specifier], import.meta.url).href, context);
  return next(specifier, context);
}
