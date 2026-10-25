import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Admin from "./Admin";
import "./index.css";

if ("serviceWorker" in navigator) {
  void navigator.serviceWorker.register("/sw.js");
}

const AdminMode = import.meta.env.VITE_ADMIN_MODE === "true";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {AdminMode ? <Admin onExit={() => {}} /> : <App />}
  </React.StrictMode>,
);
