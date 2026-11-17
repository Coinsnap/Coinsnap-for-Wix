import { state } from "./state.mjs";

export const secrets = {
  async getSecretValue(name) {
    if (!(name in state.secrets)) throw new Error("not found");
    return { value: state.secrets[name] };
  },
};
export const elevate = (fn) => fn;

// Unit tests set state.fetch; the Docker run points FAKE_COINSNAP at a fake API.
export async function fetch(url, init) {
  if (state.fetch) return state.fetch(url, init);
  const base = process.env.FAKE_COINSNAP;
  if (!base) throw new Error("no fetch configured");
  return globalThis.fetch(url.replace("https://app.coinsnap.io/", base), init);
}

export const response = (opts) => ({ status: opts.status, body: opts.body ?? "" });
export const ok = () => ({ status: 200, body: "" });
