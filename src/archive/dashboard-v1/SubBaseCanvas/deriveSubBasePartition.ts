// R5-009 — Pure derivation: filter a frame by an active sub-base, then
// project records into ListItem shape (title + inline fields), reusing
// the same model as MPLAN-008 DataList.

import type { DataFrame } from "src/lib/dataframe/dataframe";
import { applyFilter } from "src/lib/engine/filterEvaluator";
import type { FilterDefinition } from "src/settings/base/settings";
import { deriveListItems, type ListItem } from "../DataList/deriveListItems";

export interface SubBaseLike {
  readonly id: string;
  readonly name: string;
  readonly filter: FilterDefinition;
}

export function partitionFrame(
  frame: DataFrame,
  subBase: SubBaseLike | undefined
): DataFrame {
  if (!subBase) return frame;
  return applyFilter(frame, subBase.filter);
}

export function deriveSubBaseItems(
  frame: DataFrame,
  subBase: SubBaseLike | undefined,
  config:
    | {
        readonly titleField?: string;
        readonly fields: string[];
        readonly limit?: number;
      }
    | undefined
): ListItem[] {
  const partitioned = partitionFrame(frame, subBase);
  return deriveListItems(partitioned, config);
}
