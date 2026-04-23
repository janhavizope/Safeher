const DEVICE_ID_KEY = "safeher.deviceId";

function createDeviceId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  const randomPart = Math.random().toString(36).slice(2);
  return `${Date.now()}-${randomPart}`;
}

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") {
    return "server-side-device";
  }

  const existing = window.localStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  const created = createDeviceId();
  window.localStorage.setItem(DEVICE_ID_KEY, created);
  return created;
}
