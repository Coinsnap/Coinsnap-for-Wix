import { state } from "./state.mjs";

const key = (c, id) => `${c}/${id}`;
export default {
  async get(collection, id) {
    return state.data.get(key(collection, id)) ?? null;
  },
  async insert(collection, item) {
    const k = key(collection, item._id);
    if (state.data.has(k)) {
      const e = new Error(`Item with _id ${item._id} already exists`);
      e.code = "WDE0074";
      throw e;
    }
    state.data.set(k, { ...item });
    return item;
  },
  async remove(collection, id) {
    state.data.delete(key(collection, id));
  },
};
