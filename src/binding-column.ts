import type { HuozigeBindingColumn } from "./types.js";

export function getBindingGuid(column: HuozigeBindingColumn): string {
  if (!column.guid) {
    throw new Error("Binding column is missing guid.");
  }

  return column.guid;
}
