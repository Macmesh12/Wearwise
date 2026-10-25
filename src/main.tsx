import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Admin from "./Admin";
import "./index.css";

if ("serviceWorker" in navigator) {
  void navigator.serviceWorker.register("/sw.js");
}

const AdminMode = import.meta.env.VITE_ADMIN_MODE === "true";

// Inject correct PWA manifest based on environment
if (typeof document !== "undefined") {
  const manifestLink = document.createElement("link");
  manifestLink.rel = "manifest";
  manifestLink.href = AdminMode ? "/manifest.webmanifest" : "/client-manifest.webmanifest";
  document.head.appendChild(manifestLink);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {AdminMode ? <Admin onExit={() => {}} /> : <App />}
  </React.StrictMode>,
);
