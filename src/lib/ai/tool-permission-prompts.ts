import { ToolPermissionManager, DEFAULT_TOOLS, type ToolPermission, type ToolPermissionState } from './tool-permissions';

export { DEFAULT_TOOLS };
export type { ToolPermission, ToolPermissionState };

export interface ToolPromptState {
  isPrompting: boolean;
  toolId?: string;
  toolName?: string;
  toolDescription?: string;
}

export interface ToolPromptResult {
  toolId: string;
  permission: ToolPermission;
}

export type ToolPromptHandler = (
  toolId: string,
  toolName: string,
  description: string,
) => Promise<ToolPermission>;

export class ToolPermissionPromptManager {
  private manager: ToolPermissionManager;
  private promptState: ToolPromptState = { isPrompting: false };
  private onPrompt?: ToolPromptHandler;
  private promptResolvers: Map<string, (result: ToolPermission) => void> = new Map();

  constructor(onPrompt?: ToolPromptHandler) {
    this.onPrompt = onPrompt;
    this.manager = new ToolPermissionManager(onPrompt);
  }

  getPermission(toolId: string): ToolPermission {
    return this.manager.getPermission(toolId);
  }

  getAllPermissions(): ToolPermissionState {
    return this.manager.getAllPermissions();
  }

  setPermission(toolId: string, permission: ToolPermission): void {
    this.manager.setPermission(toolId, permission);
  }

  reset(): void {
    this.manager.reset();
    this.promptState = { isPrompting: false };
  }

  getPromptState(): ToolPromptState {
    return { ...this.promptState };
  }

  async requestPermission(toolId: string, toolName: string, description: string): Promise<ToolPermission> {
    const permission = this.manager.getPermission(toolId);
    if (permission !== 'prompt') {
      return permission;
    }

    this.promptState = { isPrompting: true, toolId, toolName, toolDescription: description };

    return new Promise<ToolPermission>((resolve) => {
      this.promptResolvers.set(toolId, resolve);
    });
  }

  resolvePrompt(toolId: string, permission: ToolPermission): void {
    const resolver = this.promptResolvers.get(toolId);
    if (resolver) {
      resolver(permission);
      this.promptResolvers.delete(toolId);
    }
    this.manager.setPermission(toolId, permission);
    this.promptState = { isPrompting: false };
  }

  cancelPrompt(toolId: string): void {
    this.resolvePrompt(toolId, 'deny');
  }

  async canExecute(toolId: string): Promise<boolean> {
    return this.manager.canExecute(toolId);
  }
}
