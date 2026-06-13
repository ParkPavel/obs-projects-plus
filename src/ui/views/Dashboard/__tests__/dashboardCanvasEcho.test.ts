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
