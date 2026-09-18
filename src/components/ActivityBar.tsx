import React from 'react';
import {
  Files,
  Search,
  GitBranch,
  Puzzle,
  Bot,
  Terminal,
  Settings,
  CircleHelp,
  Bug,
  Users,
  Monitor,
  Layout,
} from 'lucide-react';

export type ActivityView =
  | 'explorer'
  | 'search'
  | 'source-control'
  | 'extensions'
  | 'agents'
  | 'terminal'
  | 'settings'
  | 'help'
  | 'debug'
  | 'accounts'
  | 'remote'
  | 'layout';

interface ActivityBarProps {
  active: ActivityView;
  onChange: (view: ActivityView) => void;
}

const ITEMS: { id: ActivityView; icon: React.ReactNode; label: string }[] = [
  { id: 'explorer', icon: <Files size={22} />, label: 'Explorer' },
  { id: 'search', icon: <Search size={22} />, label: 'Search' },
  { id: 'source-control', icon: <GitBranch size={22} />, label: 'Source Control' },
  { id: 'extensions', icon: <Puzzle size={22} />, label: 'Extensions' },
  { id: 'agents', icon: <Bot size={22} />, label: 'Agents' },
  { id: 'terminal', icon: <Terminal size={22} />, label: 'Terminal' },
  { id: 'settings', icon: <Settings size={22} />, label: 'Settings' },
  { id: 'debug', icon: <Bug size={22} />, label: 'Debug' },
  { id: 'accounts', icon: <Users size={22} />, label: 'Accounts' },
  { id: 'remote', icon: <Monitor size={22} />, label: 'Remote' },
  { id: 'layout', icon: <Layout size={22} />, label: 'Layout' },
  { id: 'help', icon: <CircleHelp size={22} />, label: 'Help' },
];

export default function ActivityBar({ active, onChange }: ActivityBarProps) {
  return (
    <div
      className="flex flex-col items-center py-2 gap-1 select-none"
      style={{
        width: 48,
        background: '#181818',
        borderRight: '1px solid #333',
      }}
    >
      {ITEMS.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            title={item.label}
            onClick={() => onChange(item.id)}
            style={{
              position: 'relative',
              width: 48,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isActive ? '#2d2d2d' : 'transparent',
              color: isActive ? '#fff' : '#888',
              border: 'none',
              borderLeft: isActive ? '3px solid #007acc' : '3px solid transparent',
              cursor: 'pointer',
              borderRadius: 0,
              transition: 'all 0.1s',
            }}
          >
            {item.icon}
            {isActive && (
              <span
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#007acc',
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
