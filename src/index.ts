import {
  __resetTokenCacheForTests,
  callGetComboBindingOptionsWithCookie,
  callGetTableDataWithOffsetWithCookie,
  callServerCommandWithCookie,
  invoke
} from "./client.js";

export type {
  HuozigeBindingColumn,
  HuozigeCallback,
  HuozigeComboBinding,
  HuozigeRequestMethod,
  HuozigeTableBinding
} from "./types.js";
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
