import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Nunito_Sans } from "next/font/google"
import "./globals.css"

const nunito = Nunito_Sans({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
})

export const metadata: Metadata = {
  title: "Attendance",
  description: "QR attendance for courses and sections",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${nunito.className} h-full antialiased`}
    >
      <body className={`${nunito.className} flex min-h-full flex-col bg-background font-sans text-foreground`}>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
