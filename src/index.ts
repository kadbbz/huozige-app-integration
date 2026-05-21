import {
  __resetTokenCacheForTests,
  callGetComboBindingOptionsWithCookie,
  callGetTableDataWithOffsetWithCookie,
  callServerCommandWithCookie,
  invoke
} from "./client.js";

export type { HuozigeCallback, HuozigeRequestMethod } from "./types.js";
export {
  __resetTokenCacheForTests,
  callGetComboBindingOptionsWithCookie,
  callGetTableDataWithOffsetWithCookie,
  callServerCommandWithCookie,
  invoke
};

export const HuozigeWebApiSdk = {
  invoke,
  callServerCommandWithCookie,
  callGetTableDataWithOffsetWithCookie,
  callGetComboBindingOptionsWithCookie
};
