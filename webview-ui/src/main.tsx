import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import ErrorBoundary from "@/components/ErrorBoundary";

// Initialize VS Code API for webview communication
declare const acquireVsCodeApi: () => any;
try {
  (window as any).vscode = acquireVsCodeApi();
} catch {
  // acquireVsCodeApi is not available in non-webview contexts
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
