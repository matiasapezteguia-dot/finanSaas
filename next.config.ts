import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

const sentryOptions = {
  silent: true, // 👈 Esto hace que si falla el token o no hay, ignore el error y termine el build igual!
  hideSourceMaps: true,
  disableLogger: true,
};

export default withSentryConfig(nextConfig, {
  silent: true, // Evita que falte el token en local y te trabe el compilador
  widenClientFileUpload: true,
  sourcemaps: {
    disable: true, // Esto desactiva la queja de TypeScript que vimos antes
  },
  disableLogger: true,
});

