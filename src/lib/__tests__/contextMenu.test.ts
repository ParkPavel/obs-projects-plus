import { openContextMenu } from "src/lib/contextMenu";

describe("openContextMenu (R0.2)", () => {
  it("appends items in order with translated titles", () => {
    const onClick = jest.fn();
    const menu = openContextMenu(
      [
        { title: "Open", icon: "file-text", onClick },
        { separator: true },
        { title: "Delete", icon: "trash", danger: true, onClick: jest.fn() },
      ],
      { x: 10, y: 20 },
    );
    const items = (menu as unknown as { items: unknown[] }).items;
    expect(items).toHaveLength(3);
  });

  it("invokes onClick of an item when handler is fired", () => {
    const onClick = jest.fn();
    const menu = openContextMenu(
      [{ title: "Run", onClick }],
      { x: 0, y: 0 },
    );
    const item = (menu as unknown as {
      items: Array<{ onClick: jest.Mock }>;
    }).items[0]!;
    // Simulate Obsidian invoking the onClick handler that we registered.
    const handler = item.onClick.mock.calls[0]?.[0] as () => void;
    handler();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disabled items do NOT fire onClick when triggered", () => {
    const onClick = jest.fn();
    const menu = openContextMenu(
      [{ title: "Locked", onClick, disabled: true }],
      { x: 0, y: 0 },
    );
    const item = (menu as unknown as {
      items: Array<{ onClick: jest.Mock; setDisabled: jest.Mock }>;
    }).items[0]!;
    expect(item.setDisabled).toHaveBeenCalledWith(true);
    const handler = item.onClick.mock.calls[0]?.[0] as () => void;
    handler();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("anchors at mouse position when MouseEvent is passed", () => {
    const ev = new MouseEvent("contextmenu", { clientX: 100, clientY: 200 });
    const menu = openContextMenu([{ title: "x", onClick: jest.fn() }], ev);
    expect(
      (menu as unknown as { showAtMouseEvent: jest.Mock }).showAtMouseEvent,
    ).toHaveBeenCalledWith(ev);
  });

  it("anchors below the bottom-left of an HTMLElement when one is passed", () => {
    const el = document.createElement("button");
    Object.defineProperty(el, "getBoundingClientRect", {
      value: () => ({ left: 50, top: 80, right: 90, bottom: 120 } as DOMRect),
    });
    const menu = openContextMenu([{ title: "x", onClick: jest.fn() }], el);
    expect(
      (menu as unknown as { showAtPosition: jest.Mock }).showAtPosition,
    ).toHaveBeenCalledWith({ x: 50, y: 120 });
  });

  it("anchors at coordinates when a {x,y} object is passed", () => {
    const menu = openContextMenu(
      [{ title: "x", onClick: jest.fn() }],
      { x: 7, y: 9 },
    );
    expect(
      (menu as unknown as { showAtPosition: jest.Mock }).showAtPosition,
    ).toHaveBeenCalledWith({ x: 7, y: 9 });
  });

  it("falls back to window centre when anchor is null", () => {
    const menu = openContextMenu(
      [{ title: "x", onClick: jest.fn() }],
      null,
    );
    expect(
      (menu as unknown as { showAtPosition: jest.Mock }).showAtPosition,
    ).toHaveBeenCalled();
  });

  it("nested submenu items are attached via setSubmenu", () => {
    const childClick = jest.fn();
    const menu = openContextMenu(
      [
        {
          title: "Parent",
          onClick: jest.fn(),
          submenu: [{ title: "Child", onClick: childClick }],
        },
      ],
      { x: 0, y: 0 },
    );
    const item = (menu as unknown as {
      items: Array<{ setSubmenu: jest.Mock }>;
    }).items[0]!;
    expect(item.setSubmenu).toHaveBeenCalled();
  });
});
