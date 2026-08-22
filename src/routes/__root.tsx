import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import '../styles.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover',
      },
      {
        name: 'theme-color',
        content: '#0f172a',
      },
      {
        name: 'mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'apple-mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'apple-mobile-web-app-status-bar-style',
        content: 'black-translucent',
      },
      {
        name: 'application-name',
        content: 'ElettroOre',
      },
      {
        title: 'ElettroOre - Gestione Ore di Lavoro & GPS',
      },
      {
        name: 'description',
        content: 'ElettroOre: Applicazione per la gestione e registrazione delle ore lavorative con geolocalizzazione GPS.',
      },
    ],
    links: [
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
      {
        rel: 'icon',
        type: 'image/png',
        href: '/app-logo.png',
      },
      {
        rel: 'apple-touch-icon',
        href: '/app-logo.png',
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
