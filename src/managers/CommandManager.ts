import type { App } from "obsidian";
import type { ProjectDefinition, ShowCommand } from "../settings/settings";

const PROJECTS_PLUGIN_ID = "obs-projects-plus";
const SHOW_COMMAND_PREFIX = `${PROJECTS_PLUGIN_ID}:show:`;

export interface CommandRegistration {
  id: string;
  name: string;
  callback: () => void;
}

/**
 * Minimal subset of `Plugin` required by `finalizeRegistrations`. Lets unit
 * tests pass a plain object without instantiating the Obsidian runtime.
 */
export interface CommandHost {
  addCommand: (cmd: CommandRegistration) => unknown;
}

/**
 * CommandManager — single source of truth for syncing per-project /
 * per-view "Show …" commands with the user's enabled-command settings.
 *
 * v4.0 (REFACTOR-008): formerly duplicated inside `main.ts`. The plugin
 * shell now delegates to this class exclusively.
 */
export class CommandManager {
  private commandsToRegister: CommandRegistration[] = [];

  constructor(private app: App) {}

  ensureCommands(enabledCommands: ShowCommand[], projects: ProjectDefinition[]): void {
    const registeredCommandIds = this.getRegisteredCommandIds();
    this.removeRedundantCommands(enabledCommands, projects, registeredCommandIds);
    this.addMissingCommands(enabledCommands, projects, registeredCommandIds);
  }

  private getRegisteredCommandIds(): Set<string> {
    return new Set(Object.keys(this.app.commands.commands).filter(id =>
      id.startsWith(SHOW_COMMAND_PREFIX)
    ));
  }

  private removeRedundantCommands(enabledCommands: ShowCommand[], projects: ProjectDefinition[], registeredCommandIds: Set<string>): void {
    registeredCommandIds.forEach(id => {
      const enabledCommand = enabledCommands.find(cmd => 
        id === this.getShowCommandId(cmd, true)
      );

      // Unregister command if it's been disabled.
      if (!enabledCommand) {
        this.app.commands.removeCommand(id);
        return;
      }

      // Unregister command if its project — or its view, if scoped — has
      // been deleted. Both checks must be present: a project may survive
      // while one of its views is removed.
      const project = projects.find(p => {
        if (enabledCommand.view) {
          return (
            p.id === enabledCommand.project &&
            !!p.views.find(v => v.id === enabledCommand.view)
          );
        }
        return p.id === enabledCommand.project;
      });
      if (!project) {
        this.app.commands.removeCommand(id);
      }
    });
  }

  private addMissingCommands(enabledCommands: ShowCommand[], projects: ProjectDefinition[], registeredCommandIds: Set<string>): void {
    enabledCommands.forEach(command => {
      const globalId = this.getShowCommandId(command, true);
      const localId = this.getShowCommandId(command, false);

      if (registeredCommandIds.has(globalId)) return;

      const project = projects.find(p => p.id === command.project);
      if (project) {
        this.registerProjectCommand(command, project, localId);
      }
    });
  }

  private registerProjectCommand(command: ShowCommand, project: ProjectDefinition, localId: string): void {
    if (command.view) {
      const view = project.views.find(v => v.id === command.view);
      if (view) {
        this.commandsToRegister.push({
          id: localId,
          name: `Show ${project.name} > ${view.name}`,
          callback: () => this.activateView(project.id, view.id),
        });
      }
    } else {
      this.commandsToRegister.push({
        id: localId,
        name: `Show ${project.name}`,
        callback: () => this.activateView(project.id),
      });
    }
  }

  private getShowCommandId(cmd: ShowCommand, global: boolean): string {
    const parts = [];
    if (global) parts.push(PROJECTS_PLUGIN_ID);
    parts.push("show");
    if (cmd.project) parts.push(cmd.project);
    if (cmd.view) parts.push(cmd.view);
    return parts.join(":");
  }

  private activateView(projectId?: string, viewId?: string): void {
    // This will be injected by the main plugin
  }

  setActivateViewFunction(fn: (projectId?: string, viewId?: string) => void): void {
    this.activateView = fn;
  }

  /**
   * Finalizes command registration by actually adding commands through the plugin.
   * This must be called after ensureCommands to actually register the new commands.
   * Safe to call repeatedly; the queue is emptied on success and preserved on a
   * missing/invalid host so the next call with a valid host can recover.
   */
  finalizeRegistrations(plugin: CommandHost | Partial<CommandHost> | null | undefined): void {
    if (!plugin || typeof (plugin as CommandHost).addCommand !== "function") {
      console.warn("CommandManager: Plugin reference required for command registration");
      return;
    }

    this.commandsToRegister.forEach(command => {
      (plugin as CommandHost).addCommand(command);
    });

    this.commandsToRegister = []; // Clear after registration
  }
}