import { callCalcBindingDataSourceWithCookie } from "./datasource-binding.js";
import { callGetComboBindingOptionsWithCookie } from "./candidate-binding.js";
import { callGetTableDataWithOffsetWithCookie } from "./table-binding.js";
import { callServerCommandWithCookie, invoke } from "./server-command.js";
import { __resetTokenCacheForTests } from "./oauth.js";

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
