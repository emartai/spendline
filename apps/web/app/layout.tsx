import type { ReactNode } from 'react'
import { JetBrains_Mono, Syne } from 'next/font/google'

import './globals.css'
import { ToastProvider } from '../components/ui/toast'

type RootLayoutProps = {
  children: ReactNode
}

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['400', '500', '700', '800'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  weight: ['400', '500'],
})

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={`${syne.variable} ${jetbrainsMono.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
