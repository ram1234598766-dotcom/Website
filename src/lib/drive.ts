/**
 * Google Drive integration for VantaOS.
 *
 * Uses the bearer access token captured during the Firebase Google sign-in
 * popup to call the Drive v3 REST API directly from the browser (static-export
 * friendly — there is no server involved).
 *
 * Scopes requested: drive.readonly (browse / open anything in My Drive,
 * read-only) + drive.file (write only into files/folders the app created).
 * Opening a user's own file never lets the app overwrite it.
 */

import {
  isFirebaseConfigured,
  buildGoogleProvider,
  runProviderSignIn,
  friendlyFirebaseError,
} from './firebase';

export class DriveError extends Error {
  constructor(
    public message: string,
    public status?: number
  ) {
    super(message);
    this.name = 'DriveError';
  }
}

const TOKEN_KEY = 'vantaos_drive_token';
const TOKEN_TTL_MS = 45 * 60 * 1000; // Google access tokens last ~1h; stay conservative.
const MIME_FOLDER = 'application/vnd.google-apps.folder';
const MIME_DOC = 'application/vnd.google-apps.document';
export const VANTAOS_FOLDER_NAME = 'VantaOS';

interface StoredToken {
  token: string;
  expiresAtMs: number;
}

let driveAccessToken: string | null = null;
let driveAccessExpiresAt = 0;

export function isDriveConfigured(): boolean {
  return isFirebaseConfigured();
}

function readStoredToken(): StoredToken | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as StoredToken) : null;
  } catch {
    return null;
  }
}

export function isDriveConnected(): boolean {
  if (driveAccessToken && Date.now() < driveAccessExpiresAt) return true;
  const stored = readStoredToken();
  if (stored && stored.token && Date.now() < stored.expiresAtMs) {
    driveAccessToken = stored.token;
    driveAccessExpiresAt = stored.expiresAtMs;
    return true;
  }
  return false;
}

export function clearDriveAccessToken(): void {
  driveAccessToken = null;
  driveAccessExpiresAt = 0;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore — storage may be unavailable
  }
}

/** Open the Google Drive consent popup and persist the resulting access token. */
export async function connectDrive(): Promise<void> {
  const { accessToken } = await runProviderSignIn(buildGoogleProvider(true));
  if (!accessToken) {
    throw new DriveError('Google did not return a Drive access token. Try again.');
  }
  driveAccessToken = accessToken;
  driveAccessExpiresAt = Date.now() + TOKEN_TTL_MS;
  try {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token: accessToken, expiresAtMs: driveAccessExpiresAt }));
  } catch {
    // Token still held in memory for this tab.
  }
}

async function getToken(): Promise<string> {
  if (!isDriveConfigured()) {
    throw new DriveError('Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* to use Drive.');
  }
  if (!isDriveConnected()) {
    throw new DriveError('Google Drive is not connected. Connect it to continue.', 401);
  }
  return driveAccessToken as string;
}

async function driveFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = await getToken();
  const res = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    let msg = `Drive API error (${res.status})`;
    try {
      const data = await res.json();
      msg = data?.error?.message || msg;
    } catch {
      // keep default message
    }
    if (res.status === 401 || res.status === 403) {
      clearDriveAccessToken();
    }
    throw new DriveError(msg, res.status);
  }
  if (res.status === 204) return null;
  return res.json();
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
}

export async function listFiles(folderId: string | null): Promise<DriveFile[]> {
  const parent = folderId ? `'${folderId.replace(/'/g, "\\'")}' in parents` : "'root' in parents";
  const q = `${parent} and trashed=false`;
  const params = new URLSearchParams({
    q,
    pageSize: '300',
    fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,size)',
    orderBy: 'folder,name',
    includeItemsFromAllDrives: 'false',
    supportsAllDrives: 'false',
  });
  const data = await driveFetch(`/files?${params.toString()}`);
  return (data?.files || []) as DriveFile[];
}

export async function ensureVantaosFolder(): Promise<string> {
  const q = `name='${VANTAOS_FOLDER_NAME}' and mimeType='${MIME_FOLDER}' and 'root' in parents and trashed=false`;
  const params = new URLSearchParams({ q, fields: 'files(id)' });
  const existing = await driveFetch(`/files?${params.toString()}`);
  if (existing?.files?.[0]?.id) return existing.files[0].id as string;
  const created = await driveFetch('/files', {
    method: 'POST',
    body: JSON.stringify({
      name: VANTAOS_FOLDER_NAME,
      mimeType: MIME_FOLDER,
      parents: ['root'],
    }),
  });
  return created.id as string;
}

export function inferMime(filename: string): string {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const map: Record<string, string> = {
    md: 'text/markdown',
    markdown: 'text/markdown',
    txt: 'text/plain',
    json: 'application/json',
    js: 'text/javascript',
    ts: 'text/typescript',
    tsx: 'text/typescript',
    jsx: 'text/javascript',
    html: 'text/html',
    htm: 'text/html',
    css: 'text/css',
    py: 'text/x-python',
    go: 'text/x-go',
    rs: 'text/x-rust',
    yaml: 'text/yaml',
    yml: 'text/yaml',
    xml: 'text/xml',
    csv: 'text/csv',
  };
  return map[ext] || 'text/plain';
}

export function canOpenInEditor(file: DriveFile): boolean {
  if (file.mimeType === MIME_DOC) return true;
  if (file.mimeType === MIME_FOLDER) return false;
  return file.mimeType === '' || file.mimeType.startsWith('text/') || inferMime(file.name) !== 'text/plain';
}

/** Read a text file from Drive (Google Docs are exported as plain text). */
export async function downloadText(file: DriveFile): Promise<string> {
  const token = await getToken();
  let url: string;
  if (file.mimeType === MIME_DOC) {
    url = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`;
  } else {
    url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
  }
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) clearDriveAccessToken();
    let msg = `Drive API error (${res.status})`;
    try {
      const data = await res.json();
      msg = data?.error?.message || msg;
    } catch {
      // keep default
    }
    throw new DriveError(msg, res.status);
  }
  return res.text();
}

export interface SavedDriveFile {
  id: string;
  name: string;
}

/**
 * Create (or update) a text file owned by the app in the VantaOS folder.
 * Pass an id to update an existing app-created file; otherwise a new file is
 * created inside the app's folder.
 */
export async function saveTextToDrive(
  name: string,
  content: string,
  existingId?: string
): Promise<SavedDriveFile> {
  let id = existingId;
  if (!id) {
    const folderId = await ensureVantaosFolder();
    const created = await driveFetch('/files', {
      method: 'POST',
      body: JSON.stringify({
        name,
        parents: [folderId],
        mimeType: inferMime(name),
      }),
    });
    id = created.id as string;
  }
  const token = await getToken();
  const mime = inferMime(name);
  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': mime,
      },
      body: content,
    }
  );
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) clearDriveAccessToken();
    let msg = `Drive upload failed (${res.status})`;
    try {
      const data = await res.json();
      msg = data?.error?.message || msg;
    } catch {
      // keep default
    }
    throw new DriveError(msg, res.status);
  }
  return { id, name };
}

export { friendlyFirebaseError };