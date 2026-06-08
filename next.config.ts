import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  // Le pasamos las credenciales reales de tu .env.local al compilador
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  silent: false, // ¡Ponelo en false para ver en la consola cómo se conecta con éxito!
  widenClientFileUpload: true,
  sourcemaps: {
    disable: false, // ¡Ponelo en false! Ahora que hay token real, que suba los mapas sin miedo
  },
  disableLogger: true,
});