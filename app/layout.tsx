import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VantaOS — The Intelligent Developer Cloud',
  description:
    'Write, build, and deploy full-stack applications entirely in the browser. A cloud IDE with Monaco editor, Omni-AI assistant, local model hub, GitHub sync, and real-time community forum.',
  keywords: ['cloud IDE', 'browser IDE', 'developer cloud', 'VantaOS', 'online code editor', 'AI coding assistant'],
  openGraph: {
    title: 'VantaOS — The Intelligent Developer Cloud',
    description: 'Write, build, and deploy full-stack applications entirely in the browser.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#07070b',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
