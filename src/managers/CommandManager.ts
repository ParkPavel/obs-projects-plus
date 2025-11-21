import type { App } from "obsidian";
import type { ProjectDefinition, ShowCommand } from "../settings/settings";

const PROJECTS_PLUGIN_ID = "obs-projects-plus";

export interface CommandRegistration {
  id: string;
  name: string;
  callback: () => void;
}

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
      id.startsWith(`${PROJECTS_PLUGIN_ID}:`)
    ));
  }

  private removeRedundantCommands(enabledCommands: ShowCommand[], projects: ProjectDefinition[], registeredCommandIds: Set<string>): void {
    registeredCommandIds.forEach(id => {
      const enabledCommand = enabledCommands.find(cmd => 
        id === this.getShowCommandId(cmd, true)
      );

      if (!enabledCommand) {
        this.app.commands.removeCommand(id);
        return;
      }

      const project = projects.find(p => p.id === enabledCommand.project);
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
   * Finalizes command registration by actually adding commands through the plugin
   * This must be called after ensureCommands to actually register the new commands
   */
  finalizeRegistrations(plugin: any): void {
    if (!plugin || !plugin.addCommand) {
      console.warn("CommandManager: Plugin reference required for command registration");
      return;
    }

    this.commandsToRegister.forEach(command => {
      plugin.addCommand(command);
    });

    this.commandsToRegister = []; // Clear after registration
  }
}