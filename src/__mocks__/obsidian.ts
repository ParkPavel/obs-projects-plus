import { jest } from "@jest/globals";

// Mock Platform
export const Platform = {
  isSafari: false,
  isMobile: false,
  isDesktop: true,
  hasFlash: false,
  isMacOS: false,
  isWindows: true,
  isLinux: false,
};

// Mock App
export class MockApp {
  vault = new MockVault();
  workspace = new MockWorkspace();
  plugins = new MockPlugins();
  keymap = new MockKeymap();
  commands = new MockCommands();
  metadataCache = new MockMetadataCache();
  fileManager = new MockFileManager();
  viewRegistry = new MockViewRegistry();
}

// Mock Vault
 
class MockVault {
  adapter = new MockAdapter();
  
   
  getAbstractFileByPath(path: string): any {
    return new MockTFile(path);
  }
  
   
  create(path: string, data: string): Promise<any> {
    return Promise.resolve(new MockTFile(path));
  }
  
   
  modify(file: any, data: string): Promise<void> {
    return Promise.resolve();
  }
  
   
  read(file: any): Promise<string> {
    return Promise.resolve("Mock content");
  }
  
   
  delete(file: any): Promise<void> {
    return Promise.resolve();
  }
  
   
  rename(file: any, newPath: string): Promise<void> {
    return Promise.resolve();
  }
}

// Mock Workspace
class MockWorkspace {
  on = jest.fn();
  off = jest.fn();
  onLayoutChange = jest.fn();
  getActiveViewOfType = jest.fn();
  getLeavesOfType = jest.fn();
  revealLeaf = jest.fn();
  setActiveLeaf = jest.fn();
}

// Mock Plugins
class MockPlugins {
  enablePlugin = jest.fn();
  disablePlugin = jest.fn();
  isEnabled = jest.fn(() => true);
  loadManifest = jest.fn();
}

// Mock Keymap
class MockKeymap {
  findKeyStroke = jest.fn();
  checkModifiers = jest.fn();
}

// Mock Commands
class MockCommands {
  removeCommand = jest.fn();
  addCommand = jest.fn();
  executeCommandById = jest.fn();
}

// Mock MetadataCache
class MockMetadataCache {
  getFileCache = jest.fn();
  getCache = jest.fn();
  getFirstLinkpathDest = jest.fn();
  on = jest.fn();
  off = jest.fn();
}

// Mock FileManager
class MockFileManager {
  getNewFileTitle = jest.fn();
  getLinkpath = jest.fn();
  on = jest.fn();
  off = jest.fn();
}

// Mock ViewRegistry
class MockViewRegistry {
  on = jest.fn();
  off = jest.fn();
  getViewCreator = jest.fn();
  getTypeByExtension = jest.fn();
}

// Mock Adapter
class MockAdapter {
  basePath = "";
  write = jest.fn();
  writeBinary = jest.fn();
  mkdir = jest.fn();
  read = jest.fn();
  readBinary = jest.fn();
  remove = jest.fn();
  rename = jest.fn();
  exists = jest.fn();
  stat = jest.fn();
  list = jest.fn();
}

// Mock TFile
class MockTFile {
  path: string;
  name: string;
  
  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() || 'file.md';
  }
  
  get basename() {
    return this.name.replace(/\.[^/.]+$/, "");
  }
  
  get extension() {
    return this.name.split('.').pop() || 'md';
  }
}


// Mock Menu (R0.2 — needed by contextMenu helper and downstream callers)
export class Menu {
  items: any[] = [];
  addItem(cb: (item: any) => any) {
    const item: any = {
      setTitle: jest.fn().mockReturnThis(),
      setIcon: jest.fn().mockReturnThis(),
      setDisabled: jest.fn().mockReturnThis(),
      setSection: jest.fn().mockReturnThis(),
      setWarning: jest.fn().mockReturnThis(),
      setSubmenu: jest.fn(() => new Menu()),
      onClick: jest.fn().mockReturnThis(),
    };
    cb(item);
    this.items.push(item);
    return this;
  }
  addSeparator() { this.items.push({ separator: true }); return this; }
  showAtMouseEvent = jest.fn();
  showAtPosition = jest.fn();
}

// Mock TFile / TFolder / TAbstractFile (subset required by main.ts file-menu logic)
export class TAbstractFile {
  path: string;
  name: string;
  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() || '';
  }
}
export class TFile extends TAbstractFile {
  get basename() { return this.name.replace(/\.[^/.]+$/, ""); }
  get extension() { return this.name.split('.').pop() || 'md'; }
}
export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];
}

// Re-exports for tests that import from "obsidian"
export const App = MockApp;


// Mock ItemView (R1.1 — used by VisualizerPaneView and ProjectsView tests)
export class ItemView {
  contentEl: HTMLElement;
  app: any;
  navigation: boolean = true;
  constructor(public leaf: any) {
    this.contentEl = (typeof document !== "undefined" ? document.createElement("div") : { children: [] } as any);
    this.app = leaf?.app ?? new MockApp();
  }
  onload() {}
  onunload() {}
  onOpen(): Promise<void> { return Promise.resolve(); }
  onClose(): Promise<void> { return Promise.resolve(); }
  getViewType(): string { return ""; }
  getDisplayText(): string { return ""; }
  getIcon(): string { return ""; }
  onPaneMenu(_menu: any, _source: string) {}
}

// Mock WorkspaceLeaf (subset)
export class WorkspaceLeaf {
  app: any;
  constructor(app?: any) { this.app = app ?? new MockApp(); }
  detach() {}
  setViewState(_s: any) { return Promise.resolve(); }
  openFile(_f: any) { return Promise.resolve(); }
}

// Mock Notice
export class Notice {
  constructor(public message: string) {}
}

// Mock addIcon / setIcon (no-op)
export const addIcon = jest.fn();
export const setIcon = jest.fn();

// Minimal stringifyYaml — enough for demo-generator tests (UT2026-D)
export function stringifyYaml(obj: unknown): string {
  return JSON.stringify(obj) + "\n";
}

// Minimal normalizePath: forward slashes, collapse doubles, strip trailing slash
export function normalizePath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "")
    || "/";
}


// Mock Modal / SuggestModal / FuzzySuggestModal (R1.3)
export class Modal {
  contentEl: HTMLElement;
  app: any;
  constructor(app: any) {
    this.app = app;
    this.contentEl = (typeof document !== "undefined" ? document.createElement("div") : { children: [] } as any);
  }
  open() {}
  close() {}
  onOpen() {}
  onClose() {}
}
export class SuggestModal<T> extends Modal {
  inputEl: HTMLInputElement = (typeof document !== "undefined" ? document.createElement("input") : ({} as any));
  setPlaceholder(_p: string) {}
  setInstructions(_i: any) {}
}
export class FuzzySuggestModal<T> extends SuggestModal<T> {
  getSuggestions(_q: string): any[] { return []; }
  renderSuggestion(_i: any, _el: any) {}
  onChooseSuggestion(_i: any, _e: any) {}
  getItems(): T[] { return []; }
  getItemText(_t: T): string { return ""; }
  onChooseItem(_t: T, _e: any) {}
}
