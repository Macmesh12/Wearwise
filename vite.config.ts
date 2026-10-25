import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "EXPO_PUBLIC_");
  const adminMode = env.VITE_ADMIN_MODE === "true";

  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        env.EXPO_PUBLIC_SUPABASE_URL,
      ),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(
        env.EXPO_PUBLIC_ANON_KEY,
      ),
    },
    build: {
      rollupOptions: {
        input: adminMode
          ? path.resolve(__dirname, "public/admin.html")
          : path.resolve(__dirname, "index.html"),
      },
    },
  };
});
