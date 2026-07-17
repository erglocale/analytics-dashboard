import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { GroupProvider } from "@/lib/group-context";
import { Sidebar } from "@/components/sidebar";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ergOS Analytics",
  description: "Fleet charging analytics — SOC caps, nudges, simulations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-white text-slate-900">
        <GroupProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="min-w-0 flex-1 px-10 py-8">{children}</main>
          </div>
        </GroupProvider>
      </body>
    </html>
  );
}
