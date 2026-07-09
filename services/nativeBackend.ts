// Native (Capacitor APK) backend URL rewrite.
//
// On the web, relative "/api/..." requests are handled by:
//   - vercel.json rewrites (production on Vercel)
//   - vite.config.ts server.proxy (local dev)
//
// Inside a Capacitor APK the app is served from "https://localhost"
// (the WebView), so relative "/api/..." requests would hit the phone
// itself where no backend exists. This module detects the native
// environment and transparently rewrites those requests to the public
// backend, covering both fetch (auth, QR, accounts, admin, studio)
// and XMLHttpRequest (hls.js / mpegts.js video streaming).

export const BACKEND_ORIGIN = "https://movie3-one.vercel.app";

const REWRITE_PREFIXES = ["/api/", "/proxy-ugeen/"];

const isNativeApp = (): boolean => {
  try {
    const w = window as any;
    // Capacitor injects a global into the WebView at runtime.
    if (w.Capacitor?.isNativePlatform?.()) return true;
    if (w.Capacitor?.isNative) return true;
    const { protocol, hostname, port } = window.location;
    // iOS scheme / packaged file
    if (protocol === "capacitor:" || protocol === "file:") return true;
    // Android Capacitor default: https://localhost (no port).
    // Local dev always has a port (e.g. localhost:3000), so this is safe.
    if (hostname === "localhost" && port === "" && protocol === "https:") return true;
    return false;
  } catch {
    return false;
  }
};

/** Rewrites a relative backend path to an absolute backend URL when running natively. */
export const toBackendUrl = (url: string): string => {
  if (typeof url === "string" && REWRITE_PREFIXES.some((p) => url.startsWith(p))) {
    return BACKEND_ORIGIN + url;
  }
  return url;
};

/**
 * Installs global fetch + XMLHttpRequest interceptors that redirect
 * relative "/api/..." requests to the public backend. No-op on the web.
 */
export const installNativeBackend = (): void => {
  if (typeof window === "undefined" || !isNativeApp()) return;

  // --- fetch (auth, QR login, accounts, admin, subtitles, studio) ---
  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    try {
      if (typeof input === "string") {
        input = toBackendUrl(input);
      } else if (input instanceof URL) {
        input = toBackendUrl(input.pathname + input.search) as unknown as URL;
      } else if (input instanceof Request) {
        const rewritten = toBackendUrl(new URL(input.url, window.location.href).pathname + new URL(input.url, window.location.href).search);
        if (rewritten.startsWith(BACKEND_ORIGIN)) {
          input = new Request(rewritten, input);
        }
      }
    } catch {
      // fall through with the original input
    }
    return originalFetch(input as RequestInfo, init);
  }) as typeof window.fetch;

  // --- XMLHttpRequest (hls.js, mpegts.js video/live streaming) ---
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    ...rest: any[]
  ) {
    try {
      if (typeof url === "string") {
        url = toBackendUrl(url);
      } else if (url instanceof URL) {
        const rewritten = toBackendUrl(url.pathname + url.search);
        if (rewritten.startsWith(BACKEND_ORIGIN)) url = new URL(rewritten);
      }
    } catch {
      // fall through with the original url
    }
    return (originalOpen as any).call(this, method, url, ...rest);
  } as typeof XMLHttpRequest.prototype.open;

  console.log("[native] API requests routed to", BACKEND_ORIGIN);
};
