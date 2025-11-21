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
