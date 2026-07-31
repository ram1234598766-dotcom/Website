import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://vantaos.dev'),
  title: {
    default: 'VantaOS — The Intelligent Developer Cloud',
    template: '%s · VantaOS',
  },
  description:
    'Write, build, and deploy full-stack applications entirely in the browser. A cloud IDE with Monaco editor, Omni-AI assistant, local model hub, GitHub sync, and real-time community forum.',
  keywords: [
    'cloud IDE',
    'browser IDE',
    'developer cloud',
    'VantaOS',
    'online code editor',
    'AI coding assistant',
    'Monaco editor',
    'GitHub sync',
    'Ollama',
  ],
  authors: [{ name: 'Mrityunjay K' }],
  creator: 'Mrityunjay K',
  applicationName: 'VantaOS',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'VantaOS — The Intelligent Developer Cloud',
    description:
      'Write, build, and deploy full-stack applications entirely in the browser.',
    type: 'website',
    url: 'https://vantaos.dev',
    siteName: 'VantaOS',
    locale: 'en_US',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'VantaOS — The Intelligent Developer Cloud' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VantaOS — The Intelligent Developer Cloud',
    description:
      'Write, build, and deploy full-stack applications entirely in the browser.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/favicon.svg',
  },
  manifest: '/manifest.webmanifest',
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
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'VantaOS',
              applicationCategory: 'DeveloperApplication',
              operatingSystem: 'Web',
              url: 'https://vantaos.dev',
              description:
                'A browser-based development environment: cloud IDE, Omni-AI assistant, local model hub, GitHub sync, and real-time community forum.',
              creator: {
                '@type': 'Person',
                name: 'Mrityunjay K',
              },
            }),
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
