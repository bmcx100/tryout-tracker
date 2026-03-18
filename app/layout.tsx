import type { Metadata } from "next"
import { Space_Grotesk, Space_Mono, DM_Serif_Display } from "next/font/google"
import { AuthProvider } from "@/components/providers/auth-provider"
import { ToastProvider } from "@/components/providers/toast-provider"
import "./globals.css"

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
})

const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-dm-serif-display",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
})

export const metadata: Metadata = {
  title: "Cabot — Tryout Crew Tracker",
  description: "Follow your crew through every tryout level. Track your BFFs, teammates, and friends as they move through hockey tryouts.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${spaceMono.variable} ${dmSerifDisplay.variable}`}>
        <AuthProvider>
          {children}
          <ToastProvider />
        </AuthProvider>
      </body>
    </html>
  )
}
