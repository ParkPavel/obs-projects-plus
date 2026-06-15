/**
 * Barrel export for the native-query layer (#045.2).
 * See `nativeQuery.ts` for design notes.
 */
export {
  executeNativeQuery,
  applySort,
  applyLimit,
} from "./nativeQuery";
export type {
  NativeQuery,
  NativeQuerySource,
  NativeQueryDeps,
} from "./nativeQuery";
export { NativeQueryDataSource } from "./datasource";
