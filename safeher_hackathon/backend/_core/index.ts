import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "node:path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { incidentEvents } from "./incidentEvents";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";

type MapplsTokenCache = {
  accessToken: string;
  tokenType: string;
  expiresAtMs: number;
};

let mapplsTokenCache: MapplsTokenCache | null = null;

function getMapplsRestKey() {
  return (
    process.env.MAPPLS_REST_API_KEY ||
    process.env.MAPMYINDIA_REST_API_KEY ||
    process.env.BUILT_IN_FORGE_API_KEY ||
    process.env.VITE_FRONTEND_FORGE_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    ENV.forgeApiKey ||
    ""
  );
}

function getMapplsMapKey() {
  return (
    process.env.MAPPLS_MAP_SDK_KEY ||
    process.env.MAPPLS_MAP_API_KEY ||
    process.env.MAPMYINDIA_MAP_KEY ||
    getMapplsRestKey()
  );
}

async function getMapplsAuthorizationHeaders(restKey: string): Promise<Record<string, string>> {
  const clientId = process.env.MAPPLS_CLIENT_ID || process.env.MAPMYINDIA_CLIENT_ID || "";
  const clientSecret = process.env.MAPPLS_CLIENT_SECRET || process.env.MAPMYINDIA_CLIENT_SECRET || "";

  if (!clientId || !clientSecret) {
    return {
      Authorization: `Bearer ${restKey}`,
    };
  }

  if (mapplsTokenCache && Date.now() < mapplsTokenCache.expiresAtMs) {
    return {
      Authorization: `${mapplsTokenCache.tokenType} ${mapplsTokenCache.accessToken}`,
    };
  }

  const tokenResponse = await fetch("https://outpost.mapmyindia.com/api/security/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Mappls token request failed (${tokenResponse.status})`);
  }

  const tokenJson = (await tokenResponse.json()) as {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
  };

  const accessToken = tokenJson.access_token;
  const tokenType = tokenJson.token_type || "Bearer";
  if (!accessToken) {
    throw new Error("Mappls token response missing access_token");
  }

  const expiresInSec = typeof tokenJson.expires_in === "number" ? tokenJson.expires_in : 3600;
  mapplsTokenCache = {
    accessToken,
    tokenType,
    expiresAtMs: Date.now() + Math.max(expiresInSec - 60, 60) * 1000,
  };

  return {
    Authorization: `${tokenType} ${accessToken}`,
  };
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const localUploadDir = path.resolve(process.cwd(), ".uploads");
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use("/api/uploads", express.static(localUploadDir));

  app.get("/api/maps/config", (_req, res) => {
    const mapKey = getMapplsMapKey();
    const restKey = getMapplsRestKey();
    console.log("[API] /api/maps/config - Returning map keys", {
      mapKeyIsEmpty: !mapKey,
      mapKeyLength: mapKey?.length,
      restKeyIsEmpty: !restKey,
      restKeyLength: restKey?.length,
    });
    res.json({
      mapsApiKey:
        process.env.VITE_FRONTEND_FORGE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || ENV.forgeApiKey || "",
      mapplsMapApiKey: mapKey,
      mapplsRestApiKey: restKey,
    });
  });

  app.get("/api/maps/geocode", async (req, res) => {
    try {
      const address = String(req.query.address || "").trim();
      if (!address) {
        res.status(400).json({ message: "address is required" });
        return;
      }

      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", address);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "1");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("countrycodes", "in");

      const upstream = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
          "User-Agent": "SafeHer/1.0 (+https://safeher-vp61.onrender.com)",
        },
      });

      if (!upstream.ok) {
        res.status(upstream.status).json({ message: "Geocoding lookup failed" });
        return;
      }

      const results = (await upstream.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
      const first = results[0];

      if (!first?.lat || !first?.lon) {
        res.status(404).json({ message: "No geocoding result found" });
        return;
      }

      res.json({
        location: { lat: Number(first.lat), lng: Number(first.lon) },
        formattedAddress: first.display_name || address,
        placeId: first.display_name || address,
        status: "OK",
      });
    } catch (error) {
      console.error("Map geocode failed", error);
      res.status(500).json({ message: "Map geocode failed" });
    }
  });

  app.get("/api/maps/search", async (req, res) => {
    try {
      const query = String(req.query.query || "").trim();
      if (query.length < 2) {
        res.status(400).json({ message: "query is required" });
        return;
      }

      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);
      const hasBiasLocation = Number.isFinite(lat) && Number.isFinite(lng);

      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", query);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "8");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("countrycodes", "in");

      if (hasBiasLocation) {
        const delta = 0.18;
        const left = Math.max(-180, lng - delta);
        const right = Math.min(180, lng + delta);
        const top = Math.min(90, lat + delta);
        const bottom = Math.max(-90, lat - delta);
        url.searchParams.set("viewbox", `${left},${top},${right},${bottom}`);
      }

      const upstream = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
          "User-Agent": "SafeHer/1.0 (+https://safeher-vp61.onrender.com)",
        },
      });

      if (!upstream.ok) {
        res.status(upstream.status).json({ message: "Place search failed" });
        return;
      }

      const results = (await upstream.json()) as Array<{
        lat?: string;
        lon?: string;
        display_name?: string;
        name?: string;
      }>;

      const suggestions = (results || [])
        .map((item) => {
          const parsedLat = Number(item.lat);
          const parsedLng = Number(item.lon);
          if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
            return null;
          }

          return {
            placeName: item.name || item.display_name || query,
            placeAddress: item.display_name || "",
            latitude: parsedLat,
            longitude: parsedLng,
            source: "nominatim",
          };
        })
        .filter(Boolean);

      res.json({
        suggestions,
        status: "OK",
      });
    } catch (error) {
      console.error("Map search failed", error);
      res.status(500).json({ message: "Map search failed" });
    }
  });

  app.get("/api/mappls/autosuggest", async (req, res) => {
    try {
      const restKey = getMapplsRestKey();
      if (!restKey) {
        res.status(400).json({ message: "Mappls REST key missing. Set MAPPLS_REST_API_KEY." });
        return;
      }

      const query = String(req.query.query || "").trim();
      if (!query) {
        res.status(400).json({ message: "query is required" });
        return;
      }

      const params = new URLSearchParams({ query });
      const lat = String(req.query.lat || "").trim();
      const lng = String(req.query.lng || "").trim();
      if (lat && lng) {
        params.set("location", `${lat},${lng}`);
      }

      const headers = await getMapplsAuthorizationHeaders(restKey);
      const upstream = await fetch(`https://atlas.mappls.com/api/places/search/json?${params.toString()}`, {
        headers,
      });

      const text = await upstream.text();
      res.status(upstream.status).type("application/json").send(text);
    } catch (error) {
      console.error("Mappls autosuggest failed", error);
      res.status(500).json({ message: "Mappls autosuggest failed" });
    }
  });

  app.get("/api/mappls/nearby", async (req, res) => {
    try {
      const restKey = getMapplsRestKey();
      if (!restKey) {
        res.status(400).json({ message: "Mappls REST key missing. Set MAPPLS_REST_API_KEY." });
        return;
      }

      const lat = String(req.query.lat || "").trim();
      const lng = String(req.query.lng || "").trim();
      const keywords = String(req.query.keywords || "police station;hospital;fire station").trim();
      if (!lat || !lng) {
        res.status(400).json({ message: "lat and lng are required" });
        return;
      }

      const params = new URLSearchParams({
        keywords,
        refLocation: `${lat},${lng}`,
      });
      const radius = String(req.query.radius || "").trim();
      if (radius) {
        params.set("radius", radius);
      }

      const headers = await getMapplsAuthorizationHeaders(restKey);
      const upstream = await fetch(`https://atlas.mappls.com/api/places/nearby/json?${params.toString()}`, {
        headers,
      });

      const text = await upstream.text();
      res.status(upstream.status).type("application/json").send(text);
    } catch (error) {
      console.error("Mappls nearby failed", error);
      res.status(500).json({ message: "Mappls nearby failed" });
    }
  });

  app.post("/api/mappls/directions", async (req, res) => {
    try {
      const body = req.body as {
        origin?: { lat?: number; lng?: number };
        destination?: { lat?: number; lng?: number };
        profile?: string;
        alternatives?: boolean;
        steps?: boolean;
        avoidUnsafe?: boolean;
      };

      const origin = body.origin;
      const destination = body.destination;
      if (
        !origin ||
        !destination ||
        typeof origin.lat !== "number" ||
        typeof origin.lng !== "number" ||
        typeof destination.lat !== "number" ||
        typeof destination.lng !== "number"
      ) {
        res.status(400).json({ message: "origin and destination coordinates are required" });
        return;
      }

      const profile = body.profile === "walking" ? "walking" : "driving";
      const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;

      const fallbackToOsrm = async () => {
        const osrmProfile = profile === "walking" ? "foot" : "driving";
        const osrmParams = new URLSearchParams({
          overview: "full",
          geometries: "polyline",
          alternatives: body.alternatives === false ? "false" : "true",
          steps: body.steps === false ? "false" : "true",
        });

        const osrmUrl = `https://router.project-osrm.org/route/v1/${osrmProfile}/${coordinates}?${osrmParams.toString()}`;
        const osrmResponse = await fetch(osrmUrl);
        if (!osrmResponse.ok) {
          const errorText = await osrmResponse.text();
          res.status(502).json({
            message: "Both Mappls and fallback routing failed",
            details: errorText,
          });
          return;
        }

        const osrm = (await osrmResponse.json()) as {
          routes?: Array<{
            distance?: number;
            duration?: number;
            geometry?: string;
            legs?: Array<{
              distance?: number;
              duration?: number;
              steps?: Array<{
                distance?: number;
                duration?: number;
                name?: string;
                maneuver?: { type?: string; modifier?: string };
              }>;
            }>;
          }>;
        };

        res.status(200).json({
          routes: (osrm.routes || []).map((route) => ({
            distance: route.distance,
            duration: route.duration,
            geometry: route.geometry,
            legs: (route.legs || []).map((leg) => ({
              distance: leg.distance,
              duration: leg.duration,
              steps: (leg.steps || []).map((step) => ({
                distance: step.distance,
                duration: step.duration,
                name: step.name,
                maneuver: {
                  instruction: step.name || "Continue",
                  modifier: step.maneuver?.modifier,
                  type: step.maneuver?.type,
                },
              })),
            })),
          })),
          provider: "osrm-fallback",
        });
      };

      const restKey = getMapplsRestKey();
      if (!restKey) {
        await fallbackToOsrm();
        return;
      }

      const params = new URLSearchParams({
        steps: body.steps === false ? "false" : "true",
        alternatives: body.alternatives === false ? "false" : "true",
        geometries: "polyline",
        overview: "full",
      });

      if (body.avoidUnsafe !== false) {
        params.set("exclude", "ferry,motorway");
      }

      const url = `https://apis.mapmyindia.com/advancedmaps/v1/${encodeURIComponent(restKey)}/route_adv/${profile}/${coordinates}?${params.toString()}`;
      const upstream = await fetch(url);

      if (!upstream.ok) {
        await fallbackToOsrm();
        return;
      }

      const text = await upstream.text();
      res.status(upstream.status).type("application/json").send(text);
    } catch (error) {
      console.error("Mappls directions failed", error);
      res.status(500).json({ message: "Mappls directions failed" });
    }
  });

  app.get("/api/events/incidents", (req, res) => {
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    res.write("retry: 3000\n\n");
    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

    const sendUpdate = (payload: { type: string; incidentId: number; status?: string }) => {
      res.write(`event: incident-update\ndata: ${JSON.stringify(payload)}\n\n`);
    };

    incidentEvents.on("incident-update", sendUpdate);

    req.on("close", () => {
      incidentEvents.off("incident-update", sendUpdate);
      res.end();
    });
  });
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
