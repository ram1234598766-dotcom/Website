import { describe, expect, it, vi } from 'vitest';
import {
  ToolPermissionManager,
  DEFAULT_TOOLS,
  type ToolPermission,
} from '../../src/lib/ai/tool-permissions';

describe('ToolPermissionManager', () => {
  describe('canExecute', () => {
    it('returns true for allow permission', async () => {
      const manager = new ToolPermissionManager();
      manager.setPermission('weather', 'allow');
      expect(await manager.canExecute('weather')).toBe(true);
    });

    it('returns false for deny permission', async () => {
      const manager = new ToolPermissionManager();
      manager.setPermission('weather', 'deny');
      expect(await manager.canExecute('weather')).toBe(false);
    });

    it('calls onPrompt for prompt permission', async () => {
      const mockPrompt = vi.fn().mockResolvedValue('allow' as ToolPermission);
      const manager = new ToolPermissionManager(mockPrompt);
      const result = await manager.canExecute('weather');
      expect(result).toBe(true);
      expect(mockPrompt).toHaveBeenCalledWith(
        'weather',
        expect.any(String),
        expect.any(String),
      );
    });

    it('returns true for tools without requiresConfirmation (auto-allow)', async () => {
      const manager = new ToolPermissionManager();
      expect(await manager.canExecute('calc')).toBe(true);
      expect(await manager.canExecute('time')).toBe(true);
    });
  });

  describe('reset', () => {
    it('clears all permissions', async () => {
      const manager = new ToolPermissionManager();
      manager.setPermission('weather', 'allow');
      manager.setPermission('fetch', 'deny');
      manager.setPermission('calc', 'prompt');

      manager.reset();

      expect(manager.getAllPermissions()).toEqual({});
      expect(manager.getPermission('weather')).toBe('prompt');
      expect(manager.getPermission('fetch')).toBe('prompt');
    });
  });
});
