import { HeadContent, Scripts, Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { orpc, queryClient } from '@/utils/orpc'
import { ErrorBoundary } from '@/components/error-boundary'

import appCss from '../styles.css?url'

export interface RouterAppContext {
  orpc: typeof orpc
  queryClient: typeof queryClient
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  errorComponent: ErrorBoundary,
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'NEAR Intents - Competitor Comparison | compareintents.xyz',
      },
      {
        name: 'description',
        content: 'Compare NEAR Intents with leading cross-chain bridge and intent protocols including LayerZero, Wormhole, Axelar, deBridge, Across, and more. Interactive dashboard showing capabilities, features, and performance metrics.',
      },
      {
        name: 'keywords',
        content: 'NEAR Intents, cross-chain bridge, intent protocols, LayerZero, Wormhole, Axelar, deBridge, Across, CBridge, CCTP, LiFi, bridge comparison, blockchain interoperability',
      },
      {
        name: 'author',
        content: 'NEAR Intents',
      },
      {
        name: 'theme-color',
        content: '#000000',
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:url',
        content: 'https://compareintents.xyz',
      },
      {
        property: 'og:title',
        content: 'NEAR Intents - Competitor Comparison',
      },
      {
        property: 'og:description',
        content: 'Compare NEAR Intents with leading cross-chain bridge and intent protocols. Interactive dashboard showing capabilities, features, and performance metrics.',
      },
      {
        property: 'og:image',
        content: 'https://compareintents.xyz/metadata.png',
      },
      {
        property: 'og:site_name',
        content: 'NEAR Intents Competitor Comparison',
      },
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        name: 'twitter:url',
        content: 'https://compareintents.xyz',
      },
      {
        name: 'twitter:title',
        content: 'NEAR Intents - Competitor Comparison',
      },
      {
        name: 'twitter:description',
        content: 'Compare NEAR Intents with leading cross-chain bridge and intent protocols. Interactive dashboard showing capabilities, features, and performance metrics.',
      },
      {
        name: 'twitter:image',
        content: 'https://compareintents.xyz/metadata.png',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'canonical',
        href: 'https://compareintents.xyz',
      },
      {
        rel: 'icon',
        type: 'image/png',
        href: '/metadata.png',
      },
    ],
  }),

})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster richColors />
        </QueryClientProvider>
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
