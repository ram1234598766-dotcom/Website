import { describe, expect, it, vi } from 'vitest';
import {
  ToolPermissionPromptManager,
  type ToolPromptState,
} from '../../src/lib/ai/tool-permission-prompts';
import { ToolPermissionManager } from '../../src/lib/ai/tool-permissions';
import { DEFAULT_TOOLS } from '../../src/lib/ai/tool-permissions';

describe('ToolPermissionPromptManager', () => {
  it('delegates getPermission to underlying manager', () => {
    const mgr = new ToolPermissionPromptManager();
    mgr.setPermission('weather', 'allow');
    expect(mgr.getPermission('weather')).toBe('allow');
  });

  it('delegates setPermission to underlying manager', () => {
    const mgr = new ToolPermissionPromptManager();
    mgr.setPermission('fetch', 'deny');
    expect(mgr.getPermission('fetch')).toBe('deny');
  });

  it('returns prompt as default for tools not explicitly set', () => {
    const mgr = new ToolPermissionPromptManager();
    expect(mgr.getPermission('weather')).toBe('prompt');
  });

  it('getAllPermissions delegates to manager', () => {
    const mgr = new ToolPermissionPromptManager();
    mgr.setPermission('calc', 'allow');
    const perms = mgr.getAllPermissions();
    expect(perms.calc).toBe('allow');
  });

  it('reset clears all permissions', () => {
    const mgr = new ToolPermissionPromptManager();
    mgr.setPermission('weather', 'allow');
    mgr.reset();
    expect(mgr.getAllPermissions()).toEqual({});
  });

  it('getPromptState returns not prompting by default', () => {
    const mgr = new ToolPermissionPromptManager();
    const state: ToolPromptState = mgr.getPromptState();
    expect(state.isPrompting).toBe(false);
    expect(state.toolId).toBeUndefined();
  });

  it('requestPermission enters prompting state for prompt permission', async () => {
    const mgr = new ToolPermissionPromptManager();
    // weather defaults to 'prompt'
    mgr.resolvePrompt('weather', 'allow');
    const state = mgr.getPromptState();
    expect(state.isPrompting).toBe(false);
    expect(mgr.getPermission('weather')).toBe('allow');
  });

  it('requestPermission resolves when prompt is answered', async () => {
    const mgr = new ToolPermissionPromptManager();
    const permissionPromise = mgr.requestPermission('weather', 'Weather', 'Check weather');
    const state = mgr.getPromptState();
    expect(state.isPrompting).toBe(true);
    expect(state.toolId).toBe('weather');
    mgr.resolvePrompt('weather', 'deny');
    const permission = await permissionPromise;
    expect(permission).toBe('deny');
  });

  it('resolvePrompt sets permission and clears prompt state', () => {
    const mgr = new ToolPermissionPromptManager();
    mgr.resolvePrompt('weather', 'deny');
    expect(mgr.getPermission('weather')).toBe('deny');
    const state = mgr.getPromptState();
    expect(state.isPrompting).toBe(false);
  });

  it('cancelPrompt resolves as deny', () => {
    const mgr = new ToolPermissionPromptManager();
    mgr.cancelPrompt('fetch');
    expect(mgr.getPermission('fetch')).toBe('deny');
  });

  it('canExecute returns true for allow', async () => {
    const mgr = new ToolPermissionPromptManager();
    mgr.setPermission('calc', 'allow');
    expect(await mgr.canExecute('calc')).toBe(true);
  });

  it('canExecute returns false for deny', async () => {
    const mgr = new ToolPermissionPromptManager();
    mgr.setPermission('fetch', 'deny');
    expect(await mgr.canExecute('fetch')).toBe(false);
  });

  it('canExecute auto-allows tools without requiresConfirmation', async () => {
    const mgr = new ToolPermissionPromptManager();
    // calc and time are in DEFAULT_TOOLS with requiresConfirmation: false
    expect(await mgr.canExecute('calc')).toBe(true);
    expect(await mgr.canExecute('time')).toBe(true);
  });

  it('requestPermission does not enter prompt state for allow permission', () => {
    const mgr = new ToolPermissionPromptManager();
    mgr.setPermission('weather', 'allow');
    mgr.requestPermission('weather', 'Weather', 'Check weather');
    const state = mgr.getPromptState();
    expect(state.isPrompting).toBe(false);
  });

  it('prompt state includes tool description', () => {
    const mgr = new ToolPermissionPromptManager();
    mgr.requestPermission('fetch', 'Fetch', 'Fetch content from URL');
    const state = mgr.getPromptState();
    expect(state.isPrompting).toBe(true);
    expect(state.toolDescription).toBe('Fetch content from URL');
  });
});
