import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppToaster } from "@/components/sonner-toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SaaS Boilerplate",
  description: "Next.js + Supabase Auth + Drizzle ORM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const inlinedNodeEnv = JSON.stringify(
    process.env.NODE_ENV ?? "production",
  );

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          dangerouslySetInnerHTML={{
            __html: `(()=>{try{if(typeof globalThis.process==="undefined"){globalThis.process={env:{NODE_ENV:${inlinedNodeEnv}}};}}catch(_){}})();`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem("theme");
                  var theme = stored === "light" || stored === "dark" ? stored : "light";
                  var root = document.documentElement;
                  if (theme === "dark") root.classList.add("dark");
                  else root.classList.remove("dark");
                } catch (e) {}
              })();
            `,
          }}
        />
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
