import { formatTypedDate, parseTypedDate } from "../typedDate";

// 3.7.2 B1 (C3): a date field reads what a person types.
const now = new Date(2026, 9, 14, 15, 0); // 14.10.2026 15:00

const ymd = (text: string) => {
  const r = parseTypedDate(text, now);
  if (r.kind !== "date") return r.kind;
  const d = r.date;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}${r.hasTime ? ` ${p(d.getHours())}:${p(d.getMinutes())}` : ""}`;
};

describe("parseTypedDate", () => {
  it.each([
    ["14.10.2026", "2026-10-14"],
    ["1.11", "2026-11-01"],
    ["14/10/2026", "2026-10-14"],
    ["2026-10-14", "2026-10-14"],
    ["14.10.26", "2026-10-14"],
    ["14102026", "2026-10-14"],
    ["сегодня", "2026-10-14"],
    ["Завтра", "2026-10-15"],
    ["вчера", "2026-10-13"],
    ["+3", "2026-10-17"],
    ["-1", "2026-10-13"],
    ["14.10.2026 9:30", "2026-10-14 09:30"],
    ["14.10.2026 09:30", "2026-10-14 09:30"],
    ["завтра 18:00", "2026-10-15 18:00"],
    ["2026-10-14T08:05", "2026-10-14 08:05"],
    ["29.02.2028", "2028-02-29"],
  ])("%s → %s", (text, expected) => {
    expect(ymd(text)).toBe(expected);
  });

  it.each(["32.10.2026", "29.02.2025", "14.13", "31.04.2026", "abc", "14.10.2026 25:00", "14.10.2026 9:75"])(
    "%s is refused",
    (text) => {
      expect(parseTypedDate(text, now).kind).toBe("invalid");
    },
  );

  it("an empty field means clear, not invalid", () => {
    expect(parseTypedDate("   ", now).kind).toBe("empty");
  });

  it("formats back as DD.MM.YYYY with an optional clock", () => {
    expect(formatTypedDate(new Date(2026, 0, 5, 7, 3), false)).toBe("05.01.2026");
    expect(formatTypedDate(new Date(2026, 0, 5, 7, 3), true)).toBe("05.01.2026 07:03");
  });
});
