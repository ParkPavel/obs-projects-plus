import { buildLinkHref } from "../linkRender";

describe("PARITY-001 — buildLinkHref", () => {
  describe("url kind", () => {
    it("preserves https:// URL", () => {
      const r = buildLinkHref("https://example.com/x?y=1", "url");
      expect(r?.href).toBe("https://example.com/x?y=1");
      expect(r?.external).toBe(true);
    });

    it("prepends https:// for bare domain", () => {
      const r = buildLinkHref("example.com", "url");
      expect(r?.href).toBe("https://example.com");
    });

    it("rejects javascript: scheme (OWASP A03)", () => {
      expect(buildLinkHref("javascript:alert(1)", "url")).toBeNull();
      expect(buildLinkHref("JavaScript:alert(1)", "url")).toBeNull();
    });

    it("rejects data:/vbscript:/file: schemes", () => {
      expect(buildLinkHref("data:text/html,<script>", "url")).toBeNull();
      expect(buildLinkHref("vbscript:msgbox", "url")).toBeNull();
      expect(buildLinkHref("file:///etc/passwd", "url")).toBeNull();
    });

    it("rejects whitespace-containing input", () => {
      expect(buildLinkHref("https://e xample.com", "url")).toBeNull();
    });

    it("trims surrounding angle brackets/whitespace", () => {
      const r = buildLinkHref("  <https://x.io>  ", "url");
      expect(r?.href).toBe("https://x.io");
    });

    it("returns null for blank/non-string", () => {
      expect(buildLinkHref("", "url")).toBeNull();
      expect(buildLinkHref(null, "url")).toBeNull();
      expect(buildLinkHref(123 as unknown, "url")).toBeNull();
    });
  });

  describe("email kind", () => {
    it("builds mailto: from bare address", () => {
      const r = buildLinkHref("user@example.com", "email");
      expect(r?.href).toBe("mailto:user@example.com");
    });

    it("extracts <addr> form", () => {
      const r = buildLinkHref("Jane Doe <jane@example.com>", "email");
      expect(r?.href).toBe("mailto:jane@example.com");
      expect(r?.label).toContain("Jane Doe");
    });

    it("rejects whitespace inside address", () => {
      expect(buildLinkHref("u ser@x.com", "email")).toBeNull();
    });

    it("rejects missing @", () => {
      expect(buildLinkHref("plain", "email")).toBeNull();
    });
  });

  describe("phone kind", () => {
    it("builds tel: with + and digits preserved", () => {
      const r = buildLinkHref("+1 (555) 123-4567", "phone");
      expect(r?.href).toBe("tel:+15551234567");
    });

    it("strips spaces and parens", () => {
      const r = buildLinkHref("(555) 100 2000", "phone");
      expect(r?.href).toBe("tel:5551002000");
    });

    it("rejects too few digits", () => {
      expect(buildLinkHref("12-34", "phone")).toBeNull();
    });

    it("returns null for blank", () => {
      expect(buildLinkHref("   ", "phone")).toBeNull();
    });
  });
});
