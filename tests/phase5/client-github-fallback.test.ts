// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/lib/firebase', () => ({
  isFirebaseConfigured: vi.fn(() => true),
  getCurrentFireUser: vi.fn(() => null),
  onFireAuthStateChanged: vi.fn(() => () => {}),
  signUpWithEmail: vi.fn(),
  signInWithEmail: vi.fn(),
  sendPasswordResetLink: vi.fn(),
  signOutOfFirebase: vi.fn(),
  runProviderSignIn: vi.fn(async () => ({ user: {}, accessToken: null })),
  buildGoogleProvider: vi.fn(),
  buildGithubProvider: vi.fn(),
  friendlyFirebaseError: vi.fn((err: any) => String(err?.message || err)),
}));

vi.mock('../../src/lib/github', () => ({
  setFirebaseTokenGetter: vi.fn(),
  captureGitHubGrantFromUrl: vi.fn(() => false),
  importGitHubAccessToken: vi.fn(),
  connectGitHubWithDirectToken: vi.fn(),
  revokeGitHub: vi.fn(),
}));

import { client } from '../../src/lib/client';
import * as firebase from '../../src/lib/firebase';
import * as github from '../../src/lib/github';

const mockedImport = vi.mocked(github.importGitHubAccessToken);
const mockedDirect = vi.mocked(github.connectGitHubWithDirectToken);
const mockedProvider = vi.mocked(firebase.runProviderSignIn);

beforeEach(() => {
  vi.clearAllMocks();
  mockedImport.mockResolvedValue(undefined as never);
  mockedProvider.mockResolvedValue({ user: {} as any, accessToken: 'ghp_popup_token' });
  vi.mocked(firebase.getCurrentFireUser).mockReturnValue({
    getIdToken: async () => 'firebase-id-token',
  } as never);
});

describe('client GitHub sign-in', () => {
  it('falls back to a tab-scoped direct token when /api/gh/import fails', async () => {
    mockedImport.mockRejectedValueOnce(new Error('worker not configured'));
    const result = await client.auth.signInWithOAuth({
      provider: 'github',
      options: { scopes: 'user:email repo' },
    });
    expect(result.error).toBeNull();
    expect(mockedImport).toHaveBeenCalledWith('firebase-id-token', 'ghp_popup_token');
    expect(mockedDirect).toHaveBeenCalledWith('ghp_popup_token');
  });

  it('uses the worker import path when it succeeds and does not fall back', async () => {
    mockedImport.mockResolvedValueOnce(undefined as never);
    const result = await client.auth.signInWithOAuth({
      provider: 'github',
      options: { scopes: 'user:email repo' },
    });
    expect(result.error).toBeNull();
    expect(mockedImport).toHaveBeenCalledWith('firebase-id-token', 'ghp_popup_token');
    expect(mockedDirect).not.toHaveBeenCalled();
  });

  it('errors when repo scopes are requested but no access token comes back', async () => {
    mockedProvider.mockResolvedValueOnce({ user: {} as any, accessToken: null });
    const result = await client.auth.signInWithOAuth({
      provider: 'github',
      options: { scopes: 'repo' },
    });
    expect(result.error?.message).toContain('did not return an access token');
    expect(mockedDirect).not.toHaveBeenCalled();
  });
});