export type ViewState = 'home' | 'forum' | 'showcase' | 'learn' | 'cloud' | 'governance' | 'enterprise' | 'lion-suite';

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
