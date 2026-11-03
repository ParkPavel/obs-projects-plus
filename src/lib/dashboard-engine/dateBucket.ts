import dayjs from "dayjs";
import { parseStoredDate } from "src/lib/helpers/dateShape";
import type { DataValue } from "src/lib/dataframe/dataframe";
import type { DateGrouping } from "./transformTypes";

export type DateGranularity = DateGrouping["granularity"];

/** The existing GROUP BY date key, shared with transient chart selections. */
export function dateBucket(dateVal: DataValue | undefined | null, granularity: string): string {
  if (dateVal == null) return "__empty__";
  const read = dateVal instanceof Date ? dateVal : parseStoredDate(String(dateVal));
  const d = read === undefined ? dayjs(String(dateVal)).toDate() : read;
  if (!d || isNaN(d.getTime())) return "__invalid__";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  switch (granularity) {
    case "year": return `${year}`;
    case "quarter": return `${year}-Q${Math.ceil((d.getMonth() + 1) / 3)}`;
    case "month": return `${year}-${month}`;
    case "week": {
      const thu = new Date(d.getTime());
      thu.setDate(thu.getDate() + 3 - ((thu.getDay() + 6) % 7));
      const isoYear = thu.getFullYear();
      const jan4 = new Date(isoYear, 0, 4);
      const weekNum = 1 + Math.round(((thu.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
      return `${isoYear}-W${String(weekNum).padStart(2, "0")}`;
    }
    case "day":
    default: return `${year}-${month}-${day}`;
  }
}
