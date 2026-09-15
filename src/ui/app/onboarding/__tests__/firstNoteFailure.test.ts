import { firstNoteFailureMessage } from "src/ui/app/onboarding/firstNoteFailure";

describe("firstNoteFailureMessage", () => {
  it("points at the empty-table retry flow when the note file was never created", () => {
    const message = firstNoteFailureMessage(false);

    expect(message.key).toBe("onboarding.profiles.first-note-failed");
    // Carries the i18next placeholder the caller's own `t()` call fills in
    // with `name` — not manually interpolated here.
    expect(message.defaultValue).toContain("{{name}}");
    expect(message.defaultValue).toMatch(/Добавьте её вручную/);
    expect(message.defaultValue).not.toMatch(/свойств/);
  });

  it("points at checking the note's properties when the file exists but the write failed partway", () => {
    const message = firstNoteFailureMessage(true);

    expect(message.key).toBe("onboarding.profiles.first-note-partial");
    expect(message.defaultValue).toContain("{{name}}");
    expect(message.defaultValue).toMatch(/свойств/);
    // Must NOT repeat the false "nothing was created, add it again" claim.
    expect(message.defaultValue).not.toMatch(/Добавьте её вручную/);
  });
});
