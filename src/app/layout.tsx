import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { ACCENT_COLORS, ACCENT_STORAGE_KEY } from "@/lib/domain/appearance";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Tibúrcio",
    template: "%s · Tibúrcio",
  },
  description: "Bruno's command center: personal projects, jupigenio, chat and more",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f8f7" },
    { media: "(prefers-color-scheme: dark)", color: "#151c20" },
  ],
};

// Runs before the first paint so the page appears in the person's theme colour (D-027).
// Their profile is the source of truth; PreferencesSync updates this copy after sign-in.
// Green (index 0) is the default and needs no attribute.
const ACCENT_SCRIPT = `try{var a=localStorage.getItem(${JSON.stringify(ACCENT_STORAGE_KEY)});if(${JSON.stringify(ACCENT_COLORS)}.indexOf(a)>0)document.documentElement.dataset.accent=a}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: next-themes sets the theme class before hydration.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: ACCENT_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
