import { describe, expect, it } from "@jest/globals";
import { resolve } from "./settings";

describe("resolve v2", () => {
  it("resolves minimum", () => {
    const got = resolve({ version: 1 });

    expect(got).toStrictEqual({
      version: 1,
      projects: [],
      preferences: {
        animationBehavior: "smooth",
        frontmatter: {
          quoteStrings: "PLAIN",
        },
        locale: {
          firstDayOfWeek: "default",
        },
        projectSizeLimit: 1000,
        showViewTitles: true,
        commands: [],
        linkBehavior: "open-editor",
        mobileCalendarView: "month",
      },
    });
  });

  it("resolves an empty project with defaults", () => {
    const got = resolve({ version: 1, projects: [{ name: "Foo", id: "foo" }] });

    expect(got).toStrictEqual({
      version: 1,
      projects: [
        {
          name: "Foo",
          id: "foo",
          fieldConfig: {},
          defaultName: "",
          templates: [],
          excludedNotes: [],
          isDefault: false,
          views: [],
          dataview: false,
          path: "",
          query: "",
          recursive: false,
        },
      ],
      preferences: {
        animationBehavior: "smooth",
        frontmatter: {
          quoteStrings: "PLAIN",
        },
        locale: {
          firstDayOfWeek: "default",
        },
        projectSizeLimit: 1000,
        showViewTitles: true,
        commands: [],
        linkBehavior: "open-editor",
        mobileCalendarView: "month",
      },
    });
  });
});
