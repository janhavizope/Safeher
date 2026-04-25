type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const ADMIN_AUTH_KEY = "safeher.admin.authorized";
export const ADMIN_FAILED_ATTEMPTS_KEY = "safeher.admin.failedAttempts";
export const ADMIN_LOCKED_UNTIL_KEY = "safeher.admin.lockedUntil";

export const ADMIN_MAX_FAILED_ATTEMPTS = 5;
export const ADMIN_LOCKOUT_MS = 60 * 60 * 1000;

const ADMIN_PASSCODE = "safeher2026";

export type AdminAuthSnapshot = {
  isAuthorized: boolean;
  isLocked: boolean;
  remainingAttempts: number;
  remainingLockMs: number;
};

export type AttemptAdminPasscodeResult = {
  status: "success" | "failure" | "locked";
  snapshot: AdminAuthSnapshot;
};

function parseInteger(value: string | null): number {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getLockedUntil(storage: StorageLike): number {
  return parseInteger(storage.getItem(ADMIN_LOCKED_UNTIL_KEY));
}

function getFailedAttempts(storage: StorageLike): number {
  return parseInteger(storage.getItem(ADMIN_FAILED_ATTEMPTS_KEY));
}

function clearLockState(storage: StorageLike): void {
  storage.removeItem(ADMIN_LOCKED_UNTIL_KEY);
  storage.removeItem(ADMIN_FAILED_ATTEMPTS_KEY);
}

export function getAdminAuthSnapshot(
  storage: StorageLike,
  now: number = Date.now(),
): AdminAuthSnapshot {
  const lockedUntil = getLockedUntil(storage);

  if (lockedUntil > 0 && now >= lockedUntil) {
    clearLockState(storage);
  }

  const normalizedLockedUntil = getLockedUntil(storage);
  const isLocked = normalizedLockedUntil > now;
  const failedAttempts = Math.max(0, Math.min(getFailedAttempts(storage), ADMIN_MAX_FAILED_ATTEMPTS));

  return {
    isAuthorized: storage.getItem(ADMIN_AUTH_KEY) === "true",
    isLocked,
    remainingAttempts: isLocked ? 0 : Math.max(0, ADMIN_MAX_FAILED_ATTEMPTS - failedAttempts),
    remainingLockMs: isLocked ? normalizedLockedUntil - now : 0,
  };
}

export function attemptAdminPasscode(
  storage: StorageLike,
  passcode: string,
  now: number = Date.now(),
): AttemptAdminPasscodeResult {
  const before = getAdminAuthSnapshot(storage, now);
  if (before.isLocked) {
    return {
      status: "locked",
      snapshot: before,
    };
  }

  if (passcode.trim() === ADMIN_PASSCODE) {
    storage.setItem(ADMIN_AUTH_KEY, "true");
    clearLockState(storage);
    return {
      status: "success",
      snapshot: getAdminAuthSnapshot(storage, now),
    };
  }

  storage.removeItem(ADMIN_AUTH_KEY);

  const failedAttempts = Math.min(getFailedAttempts(storage) + 1, ADMIN_MAX_FAILED_ATTEMPTS);
  storage.setItem(ADMIN_FAILED_ATTEMPTS_KEY, String(failedAttempts));

  if (failedAttempts >= ADMIN_MAX_FAILED_ATTEMPTS) {
    storage.setItem(ADMIN_LOCKED_UNTIL_KEY, String(now + ADMIN_LOCKOUT_MS));
    return {
      status: "locked",
      snapshot: getAdminAuthSnapshot(storage, now),
    };
  }

  return {
    status: "failure",
    snapshot: getAdminAuthSnapshot(storage, now),
  };
}

export function clearAdminAuth(storage: StorageLike): void {
  storage.removeItem(ADMIN_AUTH_KEY);
  clearLockState(storage);
}