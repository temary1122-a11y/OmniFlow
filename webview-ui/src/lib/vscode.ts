// TODO: INTEGRATION - this module is the ONLY place the UI talks to the VS Code host.
/**
 * VS Code Webview Bridge
 * ---------------------------------------------------------------------------
 * The ONE place the UI talks to the extension host.
 *
 *   UI  --postCommand()-->  acquireVsCodeApi().postMessage()  -->  Extension
 *   Extension  --postMessage()-->  window 'message' event     -->  UI
 *
 * `acquireVsCodeApi()` may be called exactly ONCE per webview lifetime, so it
 * is wrapped in a lazily-initialised singleton.
 *
 * IMPORTANT: whether we are "connected" to the real backend is decided by an
 * explicit BACKEND_READY handshake from the extension, NOT by the presence of
 * `acquireVsCodeApi`. Relying on that global alone caused a silent fall-back
 * to the hardcoded demo simulator whenever the webview host behaved oddly.
 */

import type { BackendEvent, UiCommand } from "@/types";

interface VSCodeApi {
  postMessage(message: unknown): void;
  getState<T>(): T | undefined;
  setState<T>(state: T): void;
}

declare global {
  // Injected by VS Code into the webview document.
  function acquireVsCodeApi(): VSCodeApi;
}

// Singleton guard: acquireVsCodeApi() throws if called more than once.
let vscode: VSCodeApi | undefined;

// Authoritative connection flag. Set true ONLY when the extension confirms it is
// reachable via the BACKEND_READY handshake. This replaces the old fragile check
// that relied solely on `typeof acquireVsCodeApi === "function"`.
let backendConnected = false;

function acquireApi(): VSCodeApi | undefined {
  if (vscode) return vscode;
  try {
    if (typeof acquireVsCodeApi === "function") {
      vscode = acquireVsCodeApi();
    }
  } catch {
    vscode = undefined;
  }
  return vscode;
}

// Eagerly capture the API at module load.
acquireApi();

/** Called by the extension handshake; marks the backend as reachable. */
export function markBackendReady(): void {
  backendConnected = true;
  // Now that we know we are inside a real webview, (re)acquire the API.
  acquireApi();
}

/** True once the extension has confirmed it is reachable (handshake received). */
export const isBackendConnected = () => backendConnected;

/** True when NOT attached to a real Omni backend (standalone demo/simulator). */
export const isDemoMode = () => !backendConnected;

/**
 * Send a typed command to the extension host.
 *
 * If we are not connected to the real backend, the command is dropped with a
 * warning instead of silently triggering the hardcoded demo simulator. The
 * simulator is opt-in via the store's `demoMode` flag.
 */
export function postCommand(command: UiCommand): void {
  console.log('[vscode.ts] postCommand called:', JSON.stringify(command, null, 2));
  console.log('[vscode.ts] backendConnected:', backendConnected, 'api:', !!acquireApi());
  const api = acquireApi();
  if (api && backendConnected) {
    console.log('[vscode.ts] Sending message via VS Code API');
    api.postMessage(command);
    return;
  }
  console.warn(
    "[omni] postCommand dropped (backend not connected):",
    command.command,
  );
}

/**
 * Subscribe to backend events. Returns an unsubscribe function.
 */
export function onBackendEvent(handler: (event: BackendEvent) => void): () => void {
  const listener = (raw: MessageEvent) => {
    const data = raw.data as BackendEvent | undefined;
    if (data && typeof data === "object" && "type" in data) {
      if (data.type === "BACKEND_READY") {
        markBackendReady();
      }
      handler(data);
    }
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}

export type { VSCodeApi };
