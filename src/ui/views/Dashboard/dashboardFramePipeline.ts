import type { DataFrame } from "src/lib/dataframe/dataframe";
import type { DatabaseViewConfig } from "./types";
import { applyFormulaFields } from "src/lib/dashboard-engine/applyFormulaFields";
import { applyAutoFields, type GetFileStat } from "src/lib/dashboard-engine/applyAutoFields";

export function buildDisplayFrame(
	filteredFrame: DataFrame,
	config: DatabaseViewConfig | undefined,
	getFileStat: GetFileStat,
): DataFrame {
	return applyAutoFields(
		applyFormulaFields(filteredFrame, config?.formulaFields),
		getFileStat,
	);
}
