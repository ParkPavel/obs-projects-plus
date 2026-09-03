/**
 * #184 — the four states must not collapse back into one picture.
 *
 * The resolver distinguishes `ok`, `empty`, `broken` and `pending`; the reason
 * it bothers is that the last three all render as an empty table unless the
 * copy separates them. A resolver that returns four cases into a screen that
 * says one thing has distinguished nothing.
 *
 * This is where that is checkable. `DatabaseCallBlock` cannot be imported in
 * jest — it pulls `BoardView` → `EditNoteModal` → `FieldControl` and closes a
 * require cycle that throws before a test runs — so the mapping was made a
 * pure function rather than left inline in markup where only a substring
 * search could reach it.
 */

import type { NamedSourceView } from "src/lib/datasources/namedSource";
import { namedSourceNotice } from "../namedSourceNotice";

const FRAME = { fields: [], records: [] };

const pending: NamedSourceView = { kind: "pending" };
const broken: NamedSourceView = { kind: "broken", reason: "reads a source that no longer exists (src-x)", label: "Archive" };
const empty: NamedSourceView = { kind: "empty", frame: FRAME, label: "Archive" };
const ok: NamedSourceView = { kind: "ok", frame: FRAME, label: "Archive" };

describe("#184 — three failures, three different things said", () => {
  it("says something distinct for each of the three", () => {
    const keys = [pending, broken, empty].map((v) => namedSourceNotice(v)?.key);
    expect(new Set(keys).size).toBe(3);
    expect(keys.every((k) => typeof k === "string" && k.length > 0)).toBe(true);
  });

  it("and the fallback copy is distinct too, not just the key", () => {
    // A shared default would make every locale that has not been translated
    // yet show the same sentence for three different situations — which is the
    // failure this whole distinction exists to prevent, arriving by the back
    // door.
    const copy = [pending, broken, empty].map((v) => namedSourceNotice(v)?.fallback);
    expect(new Set(copy).size).toBe(3);
  });

  it("does not reuse the linked-project loading copy for its own waiting", () => {
    // Same picture, different cause. `database-call.source-loading` means "the
    // other project has not answered"; this means "this project's frame has not
    // arrived". Identical copy would hide which is happening.
    expect(namedSourceNotice(pending)?.key).not.toBe(
      "views.dashboard.database-call.source-loading"
    );
  });
});

describe("#184 — where each notice belongs", () => {
  it("a block that cannot show data gets its own screen", () => {
    expect(namedSourceNotice(pending)?.placement).toBe("screen");
    expect(namedSourceNotice(broken)?.placement).toBe("screen");
  });

  it("but 'nothing matched' is a hint, because it is a real answer", () => {
    // Giving `empty` a screen of its own would read as a failure. It is not
    // one: the source resolved, and it is empty.
    expect(namedSourceNotice(empty)?.placement).toBe("hint");
  });

  it("a working block says nothing at all", () => {
    expect(namedSourceNotice(ok)).toBeNull();
  });
});

describe("#184 — a broken source names itself", () => {
  it("carries the resolver's own reason, not a generic sentence", () => {
    // The reason already contains the id that failed. Replacing it with
    // "something went wrong" is how a fixable configuration becomes a mystery.
    const notice = namedSourceNotice(broken);
    expect(notice?.hint).toContain("src-x");
    expect(notice?.vars["source"]).toBe("Archive");
  });

  it("and the empty hint names the source it is empty of", () => {
    expect(namedSourceNotice(empty)?.vars["source"]).toBe("Archive");
    expect(namedSourceNotice(empty)?.fallback).toContain("{{source}}");
  });
});
