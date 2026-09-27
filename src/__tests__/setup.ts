import "@testing-library/jest-dom";
import { TextEncoder, TextDecoder } from "util";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import quarterOfYear from "dayjs/plugin/quarterOfYear";

dayjs.extend(isoWeek);
dayjs.extend(quarterOfYear);

// Polyfill for Node.js environment
(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;

// Mock IntersectionObserver
(global as any).IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
(global as any).ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Setup JSDOM environment for Svelte testing
Object.defineProperty(window, "scrollTo", {
  value: jest.fn(),
  writable: true,
});

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((_query: string) => ({
    matches: false,
    media: _query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock CSS.escape if needed
if (typeof (global as any).CSS === "undefined") {
  (global as any).CSS = { escape: (str: string) => str };
}

// Polyfill crypto.randomUUID for jsdom environments that lack it
if (typeof globalThis.crypto === "undefined") {
  (globalThis as any).crypto = {};
}
if (typeof (globalThis.crypto as any).randomUUID !== "function") {
  const { randomUUID } = require("crypto") as typeof import("crypto");
  (globalThis.crypto as any).randomUUID = randomUUID.bind(
    require("crypto")
  );
}
// Obsidian's DOM helpers are globals in the app; code prefers them to raw
// document.createElement (obsidianmd/prefer-create-el). Minimal stand-ins:
// the element, its text and class, which is all the plugin passes them.
type DomInfo = string | { text?: string; cls?: string | string[] } | undefined;
const make = <K extends keyof HTMLElementTagNameMap>(tag: K, o?: DomInfo): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  const info = typeof o === "string" ? { cls: o } : o;
  if (info?.text !== undefined) el.textContent = info.text;
  if (info?.cls) el.classList.add(...(Array.isArray(info.cls) ? info.cls : info.cls.split(" ").filter(Boolean)));
  return el;
};
const g = globalThis as any;
if (typeof g.createEl !== "function") g.createEl = make;
if (typeof g.createDiv !== "function") g.createDiv = (o?: DomInfo) => make("div", o);
if (typeof g.createSpan !== "function") g.createSpan = (o?: DomInfo) => make("span", o);
if (typeof g.createFragment !== "function") g.createFragment = () => document.createDocumentFragment();
