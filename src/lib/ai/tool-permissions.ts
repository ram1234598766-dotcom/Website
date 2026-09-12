export type ToolPermission = 'allow' | 'deny' | 'prompt';

export interface ToolDef {
  id: string;
  name: string;
  description: string;
  requiresConfirmation: boolean;
}

export interface ToolPermissionState {
  [toolId: string]: ToolPermission;
}

export const DEFAULT_TOOLS: ToolDef[] = [
  { id: 'weather', name: 'Weather', description: 'Check weather in a city', requiresConfirmation: true },
  { id: 'fetch', name: 'Fetch', description: 'Fetch content from a URL', requiresConfirmation: true },
  { id: 'calc', name: 'Calculator', description: 'Evaluate math expressions', requiresConfirmation: false },
  { id: 'time', name: 'Time', description: 'Get current time', requiresConfirmation: false },
];

export class ToolPermissionManager {
  private permissions: ToolPermissionState = {};
  private onPrompt?: (toolId: string, toolName: string, description: string) => Promise<ToolPermission>;

  constructor(onPrompt?: (toolId: string, toolName: string, description: string) => Promise<ToolPermission>) {
    this.onPrompt = onPrompt;
  }

  setPermission(toolId: string, permission: ToolPermission): void {
    this.permissions[toolId] = permission;
  }

  getPermission(toolId: string): ToolPermission {
    return this.permissions[toolId] ?? 'prompt';
  }

  getAllPermissions(): ToolPermissionState {
    return { ...this.permissions };
  }

  reset(): void {
    this.permissions = {};
  }

  async canExecute(toolId: string): Promise<boolean> {
    const tool = DEFAULT_TOOLS.find((t) => t.id === toolId);
    if (tool && !tool.requiresConfirmation) {
      return true;
    }
    const permission = this.getPermission(toolId);
    if (permission === 'allow') {
      return true;
    }
    if (permission === 'deny') {
      return false;
    }
    if (this.onPrompt) {
      const toolName = tool?.name ?? toolId;
      const description = tool?.description ?? '';
      const result = await this.onPrompt(toolId, toolName, description);
      this.permissions[toolId] = result;
      return result === 'allow';
    }
    return false;
  }
}
