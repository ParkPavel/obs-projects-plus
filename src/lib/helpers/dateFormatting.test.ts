import { describe, expect, it } from "@jest/globals";
import dayjs from "dayjs";
import {
  formatDateForProject,
  formatDateForDisplay,
  formatDateForInternal,
  parseDate,
} from "./dateFormatting";
import type { ProjectDefinition } from "src/settings/settings";

// Mock project with minimal required fields
const createMockProject = (dateFormat?: any): ProjectDefinition => ({
  name: "Test Project",
  id: "test-project",
  fieldConfig: {},
  views: [],
  defaultName: "",
  templates: [],
  excludedNotes: [],
  isDefault: false,
  dataSource: {
    kind: "folder",
    config: {
      path: "",
      recursive: false,
    },
  },
  newNotesFolder: "",
  dateFormat,
});

describe("formatDateForProject", () => {
  const testDate = dayjs("2025-01-18");

  it("formats date using project configuration (US format)", () => {
    const project = createMockProject({
      writeFormat: "MM/DD/YYYY",
      preset: "us",
    });
    expect(formatDateForProject(testDate, project)).toBe("01/18/2025");
  });

  it("formats date using project configuration (EU format)", () => {
    const project = createMockProject({
      writeFormat: "DD.MM.YYYY",
      preset: "eu",
    });
    expect(formatDateForProject(testDate, project)).toBe("18.01.2025");
  });

  it("formats date using project configuration (UK format)", () => {
    const project = createMockProject({
      writeFormat: "DD/MM/YYYY",
      preset: "uk",
    });
    expect(formatDateForProject(testDate, project)).toBe("18/01/2025");
  });

  it("formats date using project configuration (Japan format)", () => {
    const project = createMockProject({
      writeFormat: "YYYY年MM月DD日",
      preset: "japan",
    });
    expect(formatDateForProject(testDate, project)).toBe("2025年01月18日");
  });

  it("handles null date", () => {
    const project = createMockProject({
      writeFormat: "MM/DD/YYYY",
      preset: "us",
    });
    expect(formatDateForProject(null, project)).toBeNull();
  });

  it("handles invalid date", () => {
    const project = createMockProject({
      writeFormat: "MM/DD/YYYY",
      preset: "us",
    });
    const invalidDate = dayjs("invalid");
    expect(formatDateForProject(invalidDate, project)).toBeNull();
  });

  it("uses default ISO format when no config", () => {
    const project = createMockProject(undefined);
    expect(formatDateForProject(testDate, project)).toBe("2025-01-18");
  });

  it("uses default ISO format when dateFormat is undefined", () => {
    const project = createMockProject();
    expect(formatDateForProject(testDate, project)).toBe("2025-01-18");
  });

  it("includes time when configured", () => {
    const dateWithTime = dayjs("2025-01-18 14:30");
    const project = createMockProject({
      writeFormat: "MM/DD/YYYY",
      preset: "us",
      includeTime: true,
    });
    expect(formatDateForProject(dateWithTime, project)).toBe("01/18/2025 14:30");
  });

  it("includes time with ISO format", () => {
    const dateWithTime = dayjs("2025-01-18 09:15");
    const project = createMockProject({
      writeFormat: "YYYY-MM-DD",
      preset: "iso",
      includeTime: true,
    });
    expect(formatDateForProject(dateWithTime, project)).toBe("2025-01-18 09:15");
  });

  it("handles custom format", () => {
    const project = createMockProject({
      writeFormat: "DD-MMM-YYYY",
      preset: "custom",
    });
    expect(formatDateForProject(testDate, project)).toBe("18-Jan-2025");
  });

  it("handles another custom format", () => {
    const project = createMockProject({
      writeFormat: "MMM DD, YYYY",
      preset: "custom",
    });
    expect(formatDateForProject(testDate, project)).toBe("Jan 18, 2025");
  });
});

describe("formatDateForDisplay", () => {
  const testDate = dayjs("2025-01-18");

  it("uses writeFormat when displayFormat is not set", () => {
    const project = createMockProject({
      writeFormat: "MM/DD/YYYY",
      preset: "us",
    });
    expect(formatDateForDisplay(testDate, project)).toBe("01/18/2025");
  });

  it("uses displayFormat when set (different from writeFormat)", () => {
    const project = createMockProject({
      writeFormat: "YYYY-MM-DD",
      displayFormat: "MMM DD, YYYY",
      preset: "custom",
    });
    expect(formatDateForDisplay(testDate, project)).toBe("Jan 18, 2025");
  });

  it("uses displayFormat with EU write format", () => {
    const project = createMockProject({
      writeFormat: "DD.MM.YYYY",
      displayFormat: "DD MMMM YYYY",
      preset: "custom",
    });
    expect(formatDateForDisplay(testDate, project)).toBe("18 January 2025");
  });

  it("handles null date", () => {
    const project = createMockProject({
      writeFormat: "MM/DD/YYYY",
      displayFormat: "MMM DD, YYYY",
    });
    expect(formatDateForDisplay(null, project)).toBeNull();
  });

  it("handles invalid date", () => {
    const project = createMockProject({
      writeFormat: "MM/DD/YYYY",
    });
    const invalidDate = dayjs("invalid");
    expect(formatDateForDisplay(invalidDate, project)).toBeNull();
  });

  it("uses default format when no config", () => {
    const project = createMockProject(undefined);
    expect(formatDateForDisplay(testDate, project)).toBe("2025-01-18");
  });

  it("includes time when configured", () => {
    const dateWithTime = dayjs("2025-01-18 16:45");
    const project = createMockProject({
      writeFormat: "YYYY-MM-DD",
      displayFormat: "MMM DD, YYYY",
      includeTime: true,
    });
    expect(formatDateForDisplay(dateWithTime, project)).toBe("Jan 18, 2025 16:45");
  });
});

describe("formatDateForInternal", () => {
  it("always returns ISO 8601 format", () => {
    const date = dayjs("2025-01-18");
    expect(formatDateForInternal(date)).toBe("2025-01-18");
  });

  it("ignores any configuration (US date input)", () => {
    // Parse a date from timestamp to avoid format parsing issues
    const date = dayjs(new Date(2025, 0, 18)); // Jan 18, 2025
    expect(formatDateForInternal(date)).toBe("2025-01-18");
  });

  it("ignores any configuration (different input format)", () => {
    // Parse from ISO but verify internal format is consistent
    const date = dayjs("2025-01-18T14:30:00");
    expect(formatDateForInternal(date)).toBe("2025-01-18");
  });

  it("handles dates with time", () => {
    const date = dayjs("2025-01-18 14:30:45");
    // Internal format is date only, no time
    expect(formatDateForInternal(date)).toBe("2025-01-18");
  });

  it("handles null date", () => {
    expect(formatDateForInternal(null)).toBeNull();
  });

  it("handles invalid date", () => {
    const invalidDate = dayjs("invalid");
    expect(formatDateForInternal(invalidDate)).toBeNull();
  });

  it("handles different months and days", () => {
    const date = dayjs("2025-12-05");
    expect(formatDateForInternal(date)).toBe("2025-12-05");
  });

  it("handles single-digit months and days with leading zeros", () => {
    const date = dayjs("2025-03-07");
    expect(formatDateForInternal(date)).toBe("2025-03-07");
  });
});

describe("Date format presets", () => {
  const testDate = dayjs("2025-01-18");

  it("ISO preset (default)", () => {
    const project = createMockProject({
      writeFormat: "YYYY-MM-DD",
      preset: "iso",
    });
    expect(formatDateForProject(testDate, project)).toBe("2025-01-18");
  });

  it("US preset", () => {
    const project = createMockProject({
      writeFormat: "MM/DD/YYYY",
      preset: "us",
    });
    expect(formatDateForProject(testDate, project)).toBe("01/18/2025");
  });

  it("EU preset", () => {
    const project = createMockProject({
      writeFormat: "DD.MM.YYYY",
      preset: "eu",
    });
    expect(formatDateForProject(testDate, project)).toBe("18.01.2025");
  });

  it("UK preset", () => {
    const project = createMockProject({
      writeFormat: "DD/MM/YYYY",
      preset: "uk",
    });
    expect(formatDateForProject(testDate, project)).toBe("18/01/2025");
  });

  it("Japan preset", () => {
    const project = createMockProject({
      writeFormat: "YYYY年MM月DD日",
      preset: "japan",
    });
    expect(formatDateForProject(testDate, project)).toBe("2025年01月18日");
  });

  it("Custom format DD-MMM-YYYY", () => {
    const project = createMockProject({
      writeFormat: "DD-MMM-YYYY",
      preset: "custom",
    });
    expect(formatDateForProject(testDate, project)).toBe("18-Jan-2025");
  });

  it("Custom format MMM DD, YYYY", () => {
    const project = createMockProject({
      writeFormat: "MMM DD, YYYY",
      preset: "custom",
    });
    expect(formatDateForProject(testDate, project)).toBe("Jan 18, 2025");
  });

  it("Custom format DD MMMM YYYY", () => {
    const project = createMockProject({
      writeFormat: "DD MMMM YYYY",
      preset: "custom",
    });
    expect(formatDateForProject(testDate, project)).toBe("18 January 2025");
  });
});

describe("Backward compatibility", () => {
  const testDate = dayjs("2025-01-18");

  it("projects without dateFormat config use default ISO format", () => {
    const project = createMockProject(undefined);
    expect(formatDateForProject(testDate, project)).toBe("2025-01-18");
  });

  it("formatDateForDisplay works without config", () => {
    const project = createMockProject(undefined);
    expect(formatDateForDisplay(testDate, project)).toBe("2025-01-18");
  });

  it("formatDateForInternal always returns ISO regardless of project config", () => {
    // Internal format is always ISO, regardless of project configuration
    expect(formatDateForInternal(testDate)).toBe("2025-01-18");
  });
});

describe("parseDate", () => {
  it("parses ISO 8601 format", () => {
    const result = parseDate("2025-01-18");
    expect(result).not.toBeNull();
    expect(result?.format("YYYY-MM-DD")).toBe("2025-01-18");
  });

  it("parses date with time", () => {
    const result = parseDate("2025-01-18 14:30");
    expect(result).not.toBeNull();
    expect(result?.format("YYYY-MM-DD HH:mm")).toBe("2025-01-18 14:30");
  });

  it("handles null value", () => {
    const result = parseDate(null);
    expect(result).toBeNull();
  });

  it("handles undefined value", () => {
    const result = parseDate(undefined);
    expect(result).toBeNull();
  });

  it("handles empty string", () => {
    const result = parseDate("");
    expect(result).toBeNull();
  });

  it("parses dayjs object", () => {
    const input = dayjs("2025-01-18");
    const result = parseDate(input);
    expect(result).not.toBeNull();
    expect(result?.format("YYYY-MM-DD")).toBe("2025-01-18");
  });

  it("parses Date object", () => {
    const input = new Date("2025-01-18");
    const result = parseDate(input);
    expect(result).not.toBeNull();
    expect(result?.format("YYYY-MM-DD")).toBe("2025-01-18");
  });
});

describe("Edge cases", () => {
  it("handles leap year dates", () => {
    const leapDate = dayjs("2024-02-29");
    const project = createMockProject({
      writeFormat: "MM/DD/YYYY",
      preset: "us",
    });
    expect(formatDateForProject(leapDate, project)).toBe("02/29/2024");
  });

  it("handles year boundaries", () => {
    const newYear = dayjs("2025-01-01");
    const project = createMockProject({
      writeFormat: "DD.MM.YYYY",
      preset: "eu",
    });
    expect(formatDateForProject(newYear, project)).toBe("01.01.2025");
  });

  it("handles end of year", () => {
    const endYear = dayjs("2025-12-31");
    const project = createMockProject({
      writeFormat: "DD/MM/YYYY",
      preset: "uk",
    });
    expect(formatDateForProject(endYear, project)).toBe("31/12/2025");
  });

  it("handles time at midnight", () => {
    const midnight = dayjs("2025-01-18 00:00");
    const project = createMockProject({
      writeFormat: "YYYY-MM-DD",
      preset: "iso",
      includeTime: true,
    });
    expect(formatDateForProject(midnight, project)).toBe("2025-01-18 00:00");
  });

  it("handles time at 23:59", () => {
    const lastMinute = dayjs("2025-01-18 23:59");
    const project = createMockProject({
      writeFormat: "MM/DD/YYYY",
      preset: "us",
      includeTime: true,
    });
    expect(formatDateForProject(lastMinute, project)).toBe("01/18/2025 23:59");
  });
});
