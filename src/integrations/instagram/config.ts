import { ensure } from "../../common/core.js";

export const instagramScopes = [
  "instagram_business_basic",
  "instagram_business_content_publish",
] as const;
export const defaultRedirectURI =
  "https://localhost:4318/integrations/instagram/callback";
export interface InstagramConfig {
  clientId: string;
  clientSecret: string;
  redirectURI: string;
  apiVersion: string;
  enabled: boolean;
  port: number;
  secretDirectory: string;
}
export function instagramConfig(
  env: NodeJS.ProcessEnv = process.env,
): InstagramConfig {
  ensure(
    !env.ENABLE_REAL_PUBLISHING ||
      ["true", "false"].includes(env.ENABLE_REAL_PUBLISHING),
    "ENABLE_REAL_PUBLISHING must be true or false",
  );
  const redirectURI = env.INSTAGRAM_REDIRECT_URI?.trim() || defaultRedirectURI;
  const url = new URL(redirectURI);
  ensure(
    url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/integrations/instagram/callback",
    "Instagram redirect must be an exact HTTPS callback URL",
  );
  const apiVersion = env.INSTAGRAM_API_VERSION?.trim() || "";
  ensure(
    !apiVersion || /^v\d{2,3}\.0$/.test(apiVersion),
    "Use the supported Graph API version shown in your Meta Dashboard (vNN.0)",
  );
  const port = Number(env.INSTAGRAM_LOCAL_PORT || 4318);
  ensure(
    Number.isInteger(port) && port > 1023 && port < 65536,
    "Invalid Instagram local port",
  );
  return {
    clientId: env.INSTAGRAM_CLIENT_ID?.trim() || "",
    clientSecret: env.INSTAGRAM_CLIENT_SECRET?.trim() || "",
    redirectURI,
    apiVersion,
    enabled: env.ENABLE_REAL_PUBLISHING === "true",
    port,
    secretDirectory: env.INSTAGRAM_SECRET_DIRECTORY || ".local/instagram",
  };
}
export function requireVersion(config: InstagramConfig): string {
  ensure(
    config.apiVersion,
    "Set INSTAGRAM_API_VERSION to the currently supported version in Meta Dashboard",
  );
  return config.apiVersion;
}
