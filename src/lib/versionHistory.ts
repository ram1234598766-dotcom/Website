import { get, set } from 'idb-keyval';
import * as diff from 'diff';

export interface VersionRecord {
  id: string;
  filename: string;
  timestamp: string;
  hash: string;
  content: string;
  diffFromPrev: diff.Change[];
}

const VERSION_HISTORY_KEY = 'lion_script_versions';

async function generateHash(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function saveVersion(filename: string, content: string): Promise<VersionRecord | null> {
  try {
    const history: VersionRecord[] = (await get(VERSION_HISTORY_KEY)) || [];
    
    const fileHistory = history.filter(v => v.filename === filename).sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    const prevVersion = fileHistory.length > 0 ? fileHistory[fileHistory.length - 1] : null;
    
    const hash = await generateHash(content);
    
    // Don't save if hash is the same as the latest version
    if (prevVersion && prevVersion.hash === hash) {
      return null;
    }
    
    const diffFromPrev = prevVersion ? diff.diffLines(prevVersion.content, content) : diff.diffLines('', content);
    
    const newVersion: VersionRecord = {
      id: crypto.randomUUID(),
      filename,
      timestamp: new Date().toISOString(),
      hash,
      content,
      diffFromPrev
    };
    
    history.push(newVersion);
    await set(VERSION_HISTORY_KEY, history);
    
    return newVersion;
  } catch (err) {
    console.error('Failed to save version history:', err);
    return null;
  }
}

export async function getFileVersions(filename: string): Promise<VersionRecord[]> {
  const history: VersionRecord[] = (await get(VERSION_HISTORY_KEY)) || [];
  return history.filter(v => v.filename === filename).sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
