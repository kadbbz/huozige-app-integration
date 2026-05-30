import {
  __resetTokenCacheForTests,
  callCalcBindingDataSourceWithCookie,
  callGetComboBindingOptionsWithCookie,
  callGetTableDataWithOffsetWithCookie,
  callServerCommandWithCookie,
  invoke
} from "./client.js";

export type {
  HuozigeCalcBindingColumn,
  HuozigeCalcBindingDataSource,
  HuozigeCalcBindingQueryParam,
  HuozigeBindingColumn,
  HuozigeCallback,
  HuozigeComboBinding,
  HuozigeRequestMethod,
  HuozigeTableBinding
} from "./types.js";
export {
  __resetTokenCacheForTests,
  callCalcBindingDataSourceWithCookie,
  callGetComboBindingOptionsWithCookie,
  callGetTableDataWithOffsetWithCookie,
  callServerCommandWithCookie,
  invoke
};

export const HuozigeWebApiSdk = {
  invoke,
  callServerCommandWithCookie,
  callGetTableDataWithOffsetWithCookie,
  callGetComboBindingOptionsWithCookie,
  callCalcBindingDataSourceWithCookie
};
