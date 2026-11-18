import { state } from "./state.mjs";
export default {
  async submitEvent(e) {
    if (state.submitError) throw state.submitError;
    state.events.push(e.event.transaction);
  },
};
