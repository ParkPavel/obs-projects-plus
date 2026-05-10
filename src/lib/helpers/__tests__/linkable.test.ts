// MPLAN-002 — Tests for plain-text linkable detection.

import { detectLinkable } from "../linkable";

describe("detectLinkable", () => {
  test("returns null for empty / nullish", () => {
    expect(detectLinkable(null)).toBeNull();
    expect(detectLinkable(undefined)).toBeNull();
    expect(detectLinkable("")).toBeNull();
    expect(detectLinkable("   ")).toBeNull();
  });

  test("detects http/https URLs", () => {
    expect(detectLinkable("https://example.com"))
      .toEqual({ kind: "url", href: "https://example.com" });
    expect(detectLinkable("http://example.com/path?q=1"))
      .toEqual({ kind: "url", href: "http://example.com/path?q=1" });
  });

  test("detects mailto and tel as email/phone", () => {
    expect(detectLinkable("mailto:a@b.io"))
      .toEqual({ kind: "email", href: "mailto:a@b.io" });
    expect(detectLinkable("tel:+15551234"))
      .toEqual({ kind: "phone", href: "tel:+15551234" });
  });

  test("normalises bare emails to mailto:", () => {
    expect(detectLinkable("user@example.com"))
      .toEqual({ kind: "email", href: "mailto:user@example.com" });
  });

  test("normalises phone numbers to tel: with stripped formatting", () => {
    expect(detectLinkable("+1 (555) 123-4567"))
      .toEqual({ kind: "phone", href: "tel:+15551234567" });
    expect(detectLinkable("555-123-456"))
      .toEqual({ kind: "phone", href: "tel:555123456" });
  });

  test("rejects free-form text and short numbers", () => {
    expect(detectLinkable("see https://example.com here")).toBeNull();
    expect(detectLinkable("my email is a@b.io")).toBeNull();
    expect(detectLinkable("12345")).toBeNull();
    expect(detectLinkable("not-an-email@")).toBeNull();
  });

  test("trims surrounding whitespace before matching", () => {
    expect(detectLinkable("  https://x.io  "))
      .toEqual({ kind: "url", href: "https://x.io" });
  });
});
