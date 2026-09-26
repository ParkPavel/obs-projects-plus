/**
 * F3b — on the Sessions dashboard, picking a session shows its client in a
 * Clients block that has no field linking back (masterSideFilter.ts).
 */
import { DataFieldType, type DataFrame, type DataValue } from "src/lib/dataframe/dataframe";
import { filterByMasterSide } from "../masterSideFilter";

const frame = (rows: Array<[string, Record<string, DataValue>]>): DataFrame => ({
  fields: [{ name: "client", type: DataFieldType.Relation, repeated: false, identifier: false, derived: false }],
  records: rows.map(([id, values]) => ({ id, values })),
}) as unknown as DataFrame;

const sessions = frame([
  ["Сеансы/Сеанс 1.md", { client: "[[Анна]]" }],
  ["Сеансы/Сеанс 2.md", { client: "[[Клиенты/Борис]]" }],
  ["Сеансы/Сеанс 3.md", { client: "[[Никто]]" }],
]);
const clients = frame([["Клиенты/Анна.md", {}], ["Клиенты/Борис.md", {}], ["Клиенты/Вера.md", {}]]);

describe("filterByMasterSide", () => {
  test("the picked session's client, however it links", () => {
    expect(filterByMasterSide(clients, sessions, ["Сеанс 1"], "client").map((r) => r.id)).toEqual(["Клиенты/Анна.md"]);
    expect(filterByMasterSide(clients, sessions, ["Сеанс 2"], "client").map((r) => r.id)).toEqual(["Клиенты/Борис.md"]);
  });
  test("several picked sessions show each of their clients once", () => {
    expect(filterByMasterSide(clients, sessions, ["Сеанс 1", "Сеанс 2"], "client").map((r) => r.id)).toEqual(["Клиенты/Анна.md", "Клиенты/Борис.md"]);
  });
  test("a link that matches nobody shows nothing, not everything", () => {
    expect(filterByMasterSide(clients, sessions, ["Сеанс 3"], "client")).toEqual([]);
  });
});
