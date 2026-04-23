export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL?.trim();
  const appId = import.meta.env.VITE_APP_ID?.trim();
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  if (!oauthPortalUrl || !appId) {
    console.warn(
      "[Auth] Missing VITE_OAUTH_PORTAL_URL or VITE_APP_ID; using demo login."
    );
    return `${window.location.origin}/api/oauth/callback?code=demo&state=mock`;
  }

  let url: URL;
  try {
    url = new URL("/app-auth", oauthPortalUrl);
  } catch {
    console.warn("[Auth] Invalid VITE_OAUTH_PORTAL_URL; login redirect is disabled.");
    return `${window.location.origin}/`;
  }

  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
