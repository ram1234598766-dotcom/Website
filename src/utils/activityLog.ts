export interface ActivityEvent {
  id: string;
  action: string;
  timestamp: string;
  type: 'train' | 'install' | 'other';
}

export function logActivity(action: string, type: 'train' | 'install' | 'other' = 'other') {
  try {
    const existing = localStorage.getItem('activity_log');
    const logs: ActivityEvent[] = existing ? JSON.parse(existing) : [];
    logs.unshift({
      id: Math.random().toString(36).substr(2, 9),
      action,
      timestamp: new Date().toISOString(),
      type
    });
    // Keep only last 10
    if (logs.length > 10) logs.pop();
    localStorage.setItem('activity_log', JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to log activity', e);
  }
}

export function getActivities(): ActivityEvent[] {
  try {
    const existing = localStorage.getItem('activity_log');
    return existing ? JSON.parse(existing) : [];
  } catch (e) {
    return [];
  }
}
