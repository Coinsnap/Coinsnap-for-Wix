// Shared, resettable state behind the Wix stubs.
export const state = {
  secrets: {},
  data: new Map(),
  events: [],
  fetch: null,
  submitError: null,
  reset() {
    this.secrets = {};
    this.data = new Map();
    this.events = [];
    this.fetch = null;
    this.submitError = null;
  },
};
