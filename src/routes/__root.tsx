import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import darkModeCss from "../dark-mode.css?url";
import { LanguageProvider } from "../lib/i18n";
import { ThemeProvider } from "../lib/theme";
import { Toaster } from "../components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist or has been moved.</p>
        <div className="mt-6"><Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">Go home</Link></div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const route = typeof window !== "undefined" ? window.location.pathname : "unknown";

  console.error(error);
  useEffect(() => {
    console.error("TapWash runtime error", { message: error.message, route, stack: error.stack });
  }, [error, route]);

  const copyError = async () => {
    try {
      await navigator.clipboard.writeText(`Route: ${route}\nError: ${error.message}\n\n${error.stack ?? ""}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-xl">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Runtime error detected. The details below are only for diagnosis.</p>
        <div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-xs text-muted-foreground">Route</p>
          <p className="mt-1 break-all font-mono text-sm">{route}</p>
          <p className="mt-4 text-xs text-muted-foreground">Error</p>
          <p className="mt-1 break-words font-mono text-sm text-destructive">{error.message || String(error)}</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Try again</button>
          <button onClick={copyError} className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground">{copied ? "Copied" : "Copy error"}</button>
          <a href="/" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground">Go home</a>
        </div>
        {error.stack && <details className="mt-4"><summary className="cursor-pointer text-sm font-medium">Show technical details</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-muted p-3 text-xs">{error.stack}</pre></details>}
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0b1020" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "TapWash" },
      { title: "TapWash CRM — NFC Car Wash Memberships in Egypt" },
      { name: "description", content: "TapWash is Egypt's NFC-powered car wash membership platform. Tap your card, keychain or sticker and track every wash." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: darkModeCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/tapwash.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Manrope:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    let registration: ServiceWorkerRegistration | undefined;
    let interval: ReturnType<typeof setInterval> | undefined;
    const registerPwa = async () => {
      try {
        registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await registration.update();
        registration.addEventListener("updatefound", () => {
          const worker = registration?.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) worker.postMessage({ type: "SKIP_WAITING" });
          });
        });
        interval = setInterval(() => registration?.update(), 5 * 60 * 1000);
      } catch (error) { console.warn("TapWash PWA registration failed", error); }
    };
    void registerPwa();
    return () => { if (interval) clearInterval(interval); };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <Outlet />
          <Toaster position="top-center" richColors />
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
