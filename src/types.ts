export type ViewState = 'home' | 'forum' | 'showcase' | 'learn' | 'cloud' | 'governance' | 'mesh' | 'lion-suite' | 'fortress' | 'admin' | 'privacy' | 'omni-ai' | 'ai-training';

export interface Profile {
  id: string;
  username: string;
  avatar_url?: string;
  created_at: string;
}

export interface Thread {
  id: string;
  title: string;
  content: string;
  author_id: string;
  category: string;
  created_at: string;
  upvotes_count: number;
  replies_count: number;
  author?: Profile;
}

export interface Reply {
  id: string;
  thread_id: string;
  content: string;
  author_id: string;
  created_at: string;
  upvotes_count: number;
  author?: Profile;
}

export interface Upvote {
  id: string;
  user_id: string;
  thread_id?: string;
  reply_id?: string;
  created_at: string;
}

export interface Topic {
  id: string;
  title: string;
  author: string;
  replies: number;
  upvotes: number;
  category: string;
  timeAgo: string;
}

export interface AIModel {
  id: string;
  name: string;
  description: string;
  architecture: string;
  parameters: string;
  performance: string;
  category: string;
  downloads: string;
}

export interface Tutorial {
  id: string;
  title: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  category: string;
  readTime: string;
}
