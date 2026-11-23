import { packageArchivePath } from "./packageNaming";

const date = "2026-11-23T04:30:00.000Z";
test("archives retain readable Unicode names and use predictable daily numbering", () => {
  expect(packageArchivePath("Projects Plus/Packages", "Мой проект", date, 1, "AppConfig")).toBe("Projects Plus/Packages/Мой проект — 2026-11-23.zip");
  expect(packageArchivePath("Copies", "Cafe\u0301", date, 2, "AppConfig")).toBe("Copies/Café — 2026-11-23 (2).zip");
});
test.each(["../a\\b:*?", "CON", "..", "\u202e.hidden", "😀".repeat(80)])("names are portable without altering project settings: %s", name => {
  const path = packageArchivePath("Copies", name, date, 1, "AppConfig");
  expect(path.split("/")).toHaveLength(2);
  expect(path).not.toMatch(/[<>:"\\|?*\p{Cc}\p{Cf}]/u);
  expect(path.length).toBeLessThanOrEqual(240);
  expect(path).not.toMatch(/Copies\/(?:CON|PRN|AUX|NUL)[ .]/i);
  expect(path).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/u);
});
test("unsafe destinations and invalid allocation inputs fail before writes", () => {
  for (const folder of ["../outside", "AppConfig", "a".repeat(240)]) expect(() => packageArchivePath(folder, "Project", date, 1, "AppConfig")).toThrow();
  for (const ordinal of [0, 1001, 1.1]) expect(() => packageArchivePath("Copies", "Project", date, ordinal, "AppConfig")).toThrow();
  expect(() => packageArchivePath("Copies", "Project", "2026-02-30T00:00:00.000Z", 1, "AppConfig")).toThrow();
});
