import { describe, expect, it, beforeEach, afterEach, jest } from "@jest/globals";
import { CommandManager } from "../CommandManager";
import type { App } from "obsidian";
import type { ProjectDefinition, ShowCommand } from "../../settings/settings";
import { MockApp } from "../../__mocks__/obsidian";

// Mock Obsidian App
const createMockApp = (): App => {
  const app = new MockApp() as any;
  app.commands = {
    commands: {},
    removeCommand: jest.fn(),
    addCommand: jest.fn(),
  };
  return app;
};

describe("CommandManager", () => {
  let commandManager: CommandManager;
  let mockApp: App;
  let mockPlugin: any;

  beforeEach(() => {
    mockApp = createMockApp();
    commandManager = new CommandManager(mockApp);
    mockPlugin = {
      addCommand: jest.fn(),
    };
    
    // Setup mock activateView function
    commandManager.setActivateViewFunction((projectId?: string, viewId?: string) => {
      console.log(`Activating view: ${projectId}/${viewId}`);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with app reference", () => {
      expect(commandManager).toBeInstanceOf(CommandManager);
    });
  });

  describe("getShowCommandId", () => {
    it("should generate correct global command ID", () => {
      const command: ShowCommand = {
        project: "test-project",
        view: "test-view"
      };
      
      // Access private method through any cast for testing
      const result = (commandManager as any).getShowCommandId(command, true);
      expect(result).toBe("obs-projects-plus:show:test-project:test-view");
    });

    it("should generate correct local command ID", () => {
      const command: ShowCommand = {
        project: "test-project"
      };
      
      const result = (commandManager as any).getShowCommandId(command, false);
      expect(result).toBe("show:test-project");
    });

    it("should handle command without view", () => {
      const command: ShowCommand = {
        project: "test-project"
      };
      
      const globalResult = (commandManager as any).getShowCommandId(command, true);
      const localResult = (commandManager as any).getShowCommandId(command, false);
      
      expect(globalResult).toBe("obs-projects-plus:show:test-project");
      expect(localResult).toBe("show:test-project");
    });
  });

  describe("getRegisteredCommandIds", () => {
    it("should return empty set when no plugin commands exist", () => {
      mockApp.commands.commands = {};
      
      const result = (commandManager as any).getRegisteredCommandIds();
      expect(result).toEqual(new Set());
    });

    it("should filter plugin commands correctly", () => {
      mockApp.commands.commands = {
        "obs-projects-plus:show:project1": {} as any,
        "obs-projects-plus:show:project2": {} as any,
        "other-plugin:command": {} as any,
        "show:unrelated": {} as any,
      };
      
      const result = (commandManager as any).getRegisteredCommandIds();
      expect(result).toEqual(new Set([
        "obs-projects-plus:show:project1",
        "obs-projects-plus:show:project2"
      ]));
    });
  });

  describe("registerProjectCommand", () => {
    it("should register command with view", () => {
      const command: ShowCommand = {
        project: "test-project",
        view: "test-view"
      };

      const project: ProjectDefinition = {
        name: "Test Project",
        id: "test-project",
        fieldConfig: {},
        views: [
          { id: "test-view", name: "Test View", type: "table", config: {}, filter: { conjunction: "and", conditions: [] }, colors: { conditions: [] }, sort: { criteria: [] } },
          { id: "other-view", name: "Other View", type: "table", config: {}, filter: { conjunction: "and", conditions: [] }, colors: { conditions: [] }, sort: { criteria: [] } }
        ],
        defaultName: "",
        templates: [],
        excludedNotes: [],
        isDefault: false,
        dataSource: { kind: "folder", config: { path: "", recursive: false } },
        newNotesFolder: ""
      };

      (commandManager as any).registerProjectCommand(command, project, "show:test-project:test-view");

      // Check that command was added to registration queue
      expect((commandManager as any).commandsToRegister).toHaveLength(1);
      const registeredCommand = (commandManager as any).commandsToRegister[0];
      expect(registeredCommand.id).toBe("show:test-project:test-view");
      expect(registeredCommand.name).toBe("Show Test Project > Test View");
    });

    it("should register command without view", () => {
      const command: ShowCommand = {
        project: "test-project"
      };

      const project: ProjectDefinition = {
        name: "Test Project",
        id: "test-project",
        fieldConfig: {},
        views: [],
        defaultName: "",
        templates: [],
        excludedNotes: [],
        isDefault: false,
        dataSource: { kind: "folder", config: { path: "", recursive: false } },
        newNotesFolder: ""
      };

      (commandManager as any).registerProjectCommand(command, project, "show:test-project");

      expect((commandManager as any).commandsToRegister).toHaveLength(1);
      const registeredCommand = (commandManager as any).commandsToRegister[0];
      expect(registeredCommand.id).toBe("show:test-project");
      expect(registeredCommand.name).toBe("Show Test Project");
    });

    it("should not register command if view not found in project", () => {
      const command: ShowCommand = {
        project: "test-project",
        view: "missing-view"
      };

      const project: ProjectDefinition = {
        name: "Test Project",
        id: "test-project",
        fieldConfig: {},
        views: [
          { id: "test-view", name: "Test View", type: "table", config: {}, filter: { conjunction: "and", conditions: [] }, colors: { conditions: [] }, sort: { criteria: [] } }
        ],
        defaultName: "",
        templates: [],
        excludedNotes: [],
        isDefault: false,
        dataSource: { kind: "folder", config: { path: "", recursive: false } },
        newNotesFolder: ""
      };

      (commandManager as any).registerProjectCommand(command, project, "show:test-project:missing-view");

      expect((commandManager as any).commandsToRegister).toHaveLength(0);
    });
  });

  describe("removeRedundantCommands", () => {
    it("should remove commands that are no longer enabled", () => {
      const enabledCommands: ShowCommand[] = [];
      const projects: ProjectDefinition[] = [];
      const registeredCommandIds = new Set(["obs-projects-plus:show:old-project"]);

      (commandManager as any).removeRedundantCommands(enabledCommands, projects, registeredCommandIds);

      expect(mockApp.commands.removeCommand).toHaveBeenCalledWith("obs-projects-plus:show:old-project");
    });

    it("should not remove commands that are still enabled", () => {
      const enabledCommands: ShowCommand[] = [
        { project: "active-project" }
      ];
      const projects: ProjectDefinition[] = [
        {
          name: "Active Project",
          id: "active-project",
          fieldConfig: {},
          views: [],
          defaultName: "",
          templates: [],
          excludedNotes: [],
          isDefault: false,
          dataSource: { kind: "folder", config: { path: "", recursive: false } },
          newNotesFolder: ""
        }
      ];
      const registeredCommandIds = new Set(["obs-projects-plus:show:active-project"]);

      (commandManager as any).removeRedundantCommands(enabledCommands, projects, registeredCommandIds);

      expect(mockApp.commands.removeCommand).not.toHaveBeenCalled();
    });

    it("should remove commands for deleted projects", () => {
      const enabledCommands: ShowCommand[] = [
        { project: "deleted-project" }
      ];
      const projects: ProjectDefinition[] = [];
      const registeredCommandIds = new Set(["obs-projects-plus:show:deleted-project"]);

      (commandManager as any).removeRedundantCommands(enabledCommands, projects, registeredCommandIds);

      expect(mockApp.commands.removeCommand).toHaveBeenCalledWith("obs-projects-plus:show:deleted-project");
    });
  });

  describe("addMissingCommands", () => {
    it("should add new commands for enabled commands", () => {
      const enabledCommands: ShowCommand[] = [
        { project: "new-project" }
      ];
      const projects: ProjectDefinition[] = [
        {
          name: "New Project",
          id: "new-project",
          fieldConfig: {},
          views: [],
          defaultName: "",
          templates: [],
          excludedNotes: [],
          isDefault: false,
          dataSource: { kind: "folder", config: { path: "", recursive: false } },
          newNotesFolder: ""
        }
      ];
      const registeredCommandIds = new Set();

      (commandManager as any).addMissingCommands(enabledCommands, projects, registeredCommandIds);

      expect((commandManager as any).commandsToRegister).toHaveLength(1);
    });

    it("should not add commands that are already registered", () => {
      const enabledCommands: ShowCommand[] = [
        { project: "existing-project" }
      ];
      const projects: ProjectDefinition[] = [
        {
          name: "Existing Project",
          id: "existing-project",
          fieldConfig: {},
          views: [],
          defaultName: "",
          templates: [],
          excludedNotes: [],
          isDefault: false,
          dataSource: { kind: "folder", config: { path: "", recursive: false } },
          newNotesFolder: ""
        }
      ];
      const registeredCommandIds = new Set(["obs-projects-plus:show:existing-project"]);

      (commandManager as any).addMissingCommands(enabledCommands, projects, registeredCommandIds);

      expect((commandManager as any).commandsToRegister).toHaveLength(0);
    });
  });

  describe("ensureCommands", () => {
    it("should handle complete command lifecycle", () => {
      const enabledCommands: ShowCommand[] = [
        { project: "project1" },
        { project: "project2", view: "view1" }
      ];
      const projects: ProjectDefinition[] = [
        {
          name: "Project 1",
          id: "project1",
          fieldConfig: {},
          views: [],
          defaultName: "",
          templates: [],
          excludedNotes: [],
          isDefault: false,
          dataSource: { kind: "folder", config: { path: "", recursive: false } },
          newNotesFolder: ""
        },
        {
          name: "Project 2",
          id: "project2",
          fieldConfig: {},
          views: [{ id: "view1", name: "View 1", type: "table", config: {}, filter: { conjunction: "and", conditions: [] }, colors: { conditions: [] }, sort: { criteria: [] } }],
          defaultName: "",
          templates: [],
          excludedNotes: [],
          isDefault: false,
          dataSource: { kind: "folder", config: { path: "", recursive: false } },
          newNotesFolder: ""
        }
      ];

      // Mock existing commands
      mockApp.commands.commands = {
        "obs-projects-plus:show:old-project": {} as any,
        "obs-projects-plus:show:project3": {} as any
      };

      commandManager.ensureCommands(enabledCommands, projects);

      // Should remove old commands
      expect(mockApp.commands.removeCommand).toHaveBeenCalledTimes(2);

      // Should add new commands to registration queue
      expect((commandManager as any).commandsToRegister).toHaveLength(2);
    });
  });

  describe("setActivateViewFunction", () => {
    it("should set the activate view function", () => {
      const activateFn = jest.fn();
      commandManager.setActivateViewFunction(activateFn);

      // Access private activateView method to test
      (commandManager as any).activateView("test-project", "test-view");

      expect(activateFn).toHaveBeenCalledWith("test-project", "test-view");
    });
  });

  describe("finalizeRegistrations", () => {
    it("should register commands through plugin", () => {
      // Add commands to registration queue
      (commandManager as any).commandsToRegister = [
        {
          id: "test-command",
          name: "Test Command",
          callback: jest.fn()
        }
      ];

      commandManager.finalizeRegistrations(mockPlugin);

      expect(mockPlugin.addCommand).toHaveBeenCalledWith({
        id: "test-command",
        name: "Test Command",
        callback: expect.any(Function)
      });

      expect((commandManager as any).commandsToRegister).toHaveLength(0);
    });

    it("should handle missing plugin reference", () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      (commandManager as any).commandsToRegister = [
        {
          id: "test-command",
          name: "Test Command",
          callback: jest.fn()
        }
      ];

      commandManager.finalizeRegistrations(null);

      expect(consoleSpy).toHaveBeenCalledWith(
        "CommandManager: Plugin reference required for command registration"
      );

      expect(mockPlugin.addCommand).not.toHaveBeenCalled();
      expect((commandManager as any).commandsToRegister).toHaveLength(1);

      consoleSpy.mockRestore();
    });

    it("should handle missing addCommand method", () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const invalidPlugin = {};

      (commandManager as any).commandsToRegister = [
        {
          id: "test-command",
          name: "Test Command",
          callback: jest.fn()
        }
      ];

      commandManager.finalizeRegistrations(invalidPlugin);

      expect(consoleSpy).toHaveBeenCalledWith(
        "CommandManager: Plugin reference required for command registration"
      );

      expect((commandManager as any).commandsToRegister).toHaveLength(1);

      consoleSpy.mockRestore();
    });
  });
});