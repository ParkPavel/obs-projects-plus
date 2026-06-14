import { createConfigEcho } from "../dashboardConfigEcho";

interface Cfg {
  widthMode: "full" | "half" | "custom";
  src?: string;
}

describe("createConfigEcho (#100)", () => {
  test("commit → current is the committed value (optimistic)", () => {
    const echo = createConfigEcho<Cfg>({ widthMode: "full" });
    echo.commit({ widthMode: "half" });
    expect(echo.current).toEqual({ widthMode: "half" });
  });

  test("receiveProp(echo of commit) → adopts echo, clears pending", () => {
    const echo = createConfigEcho<Cfg>({ widthMode: "full" });
    echo.commit({ widthMode: "half" });
    // Authoritative store returns a fresh, structurally-equal copy.
    echo.receiveProp({ widthMode: "half" });
    expect(echo.current).toEqual({ widthMode: "half" });
    // Pending cleared: a subsequent differing prop with nothing pending is external.
    echo.receiveProp({ widthMode: "custom" });
    expect(echo.current).toEqual({ widthMode: "custom" });
  });

  test("while pending, a stale/differing prop does NOT override the optimistic value", () => {
    const echo = createConfigEcho<Cfg>({ widthMode: "full" });
    echo.commit({ widthMode: "half" });
    // A stale echo of the previous value arrives mid-flight — must be ignored.
    echo.receiveProp({ widthMode: "full" });
    expect(echo.current).toEqual({ widthMode: "half" });
  });

  test("nothing pending → receiveProp adopts external change", () => {
    const echo = createConfigEcho<Cfg>({ widthMode: "full" });
    echo.receiveProp({ widthMode: "custom", src: "x.png" });
    expect(echo.current).toEqual({ widthMode: "custom", src: "x.png" });
  });

  test("reconciliation: pending + unrecognized prop after tick → force-adopt, pending reset", () => {
    const echo = createConfigEcho<Cfg>({ widthMode: "full" });
    echo.commit({ widthMode: "half" });
    // A genuinely different external change races in while pending.
    echo.receiveProp({ widthMode: "custom" });
    expect(echo.current).toEqual({ widthMode: "half" }); // optimistic still wins pre-reconcile
    echo.reconcile();
    expect(echo.current).toEqual({ widthMode: "custom" }); // external wins after reconcile
    // Pending reset: next differing prop is treated as external immediately.
    echo.receiveProp({ widthMode: "full" });
    expect(echo.current).toEqual({ widthMode: "full" });
  });

  test("reconciliation with a clean echo already recognized is a no-op", () => {
    const echo = createConfigEcho<Cfg>({ widthMode: "full" });
    echo.commit({ widthMode: "half" });
    echo.receiveProp({ widthMode: "half" }); // recognized echo clears pending
    echo.reconcile();
    expect(echo.current).toEqual({ widthMode: "half" });
  });
});

describe("createConfigEcho rapid double-commit (#102)", () => {
  test("two commits before any reconcile: echoes do not clobber the latest optimistic value", () => {
    const echo = createConfigEcho<Cfg>({ widthMode: "full" });
    // Two optimistic commits land before the first microtask reconcile runs.
    echo.commit({ widthMode: "half" }); // pendingWrites = 1
    echo.commit({ widthMode: "custom" }); // pendingWrites = 2, latest optimistic = custom
    expect(echo.current).toEqual({ widthMode: "custom" });

    // The store now echoes the FIRST write back. Pre-#102 this would survive the
    // first reconcile zeroing pendingWrites and then be treated as authoritative,
    // clobbering "custom". The echo of "half" differs from current ("custom"), so
    // it is remembered but the optimistic value must keep winning.
    echo.receiveProp({ widthMode: "half" });
    expect(echo.current).toEqual({ widthMode: "custom" });

    // First reconcile (for commit #1): decrement to 1, still pending — optimistic wins.
    echo.reconcile();
    expect(echo.current).toEqual({ widthMode: "custom" });

    // The store now echoes the SECOND (latest) write — a clean echo clears pending.
    echo.receiveProp({ widthMode: "custom" });
    expect(echo.current).toEqual({ widthMode: "custom" });

    // Second reconcile (for commit #2): pending already cleared by the clean echo.
    echo.reconcile();
    expect(echo.current).toEqual({ widthMode: "custom" });

    // Pending fully settled: a later differing prop is now an authoritative external.
    echo.receiveProp({ widthMode: "full" });
    expect(echo.current).toEqual({ widthMode: "full" });
  });

  test("genuine external change during a double-commit window is eventually adopted, not lost", () => {
    const echo = createConfigEcho<Cfg>({ widthMode: "full" });
    echo.commit({ widthMode: "half" }); // pendingWrites = 1
    echo.commit({ widthMode: "custom" }); // pendingWrites = 2

    // A genuinely external change races in while both writes are in flight.
    echo.receiveProp({ widthMode: "full", src: "external.png" });
    // Optimistic value still wins while writes are pending.
    expect(echo.current).toEqual({ widthMode: "custom" });

    // First reconcile: decrement to 1, still pending — must NOT force-adopt yet
    // (doing so could clobber a newer optimistic value), and must NOT drop the
    // remembered external change.
    echo.reconcile();
    expect(echo.current).toEqual({ widthMode: "custom" });

    // Last reconcile: final write settles → the external change is force-adopted.
    echo.reconcile();
    expect(echo.current).toEqual({ widthMode: "full", src: "external.png" });
  });

  test("interleaved reconciles between commits stay symmetric (never goes negative)", () => {
    const echo = createConfigEcho<Cfg>({ widthMode: "full" });
    echo.commit({ widthMode: "half" }); // pendingWrites = 1
    echo.reconcile(); // → 0
    echo.reconcile(); // guarded no-op, stays 0
    echo.commit({ widthMode: "custom" }); // pendingWrites = 1
    // Echo of the first (now stale) write must be ignored mid-flight.
    echo.receiveProp({ widthMode: "half" });
    expect(echo.current).toEqual({ widthMode: "custom" });
    echo.reconcile(); // → 0
    echo.receiveProp({ widthMode: "full" }); // authoritative external
    expect(echo.current).toEqual({ widthMode: "full" });
  });
});
