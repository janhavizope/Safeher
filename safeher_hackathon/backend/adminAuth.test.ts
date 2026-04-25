import { describe, expect, it } from "vitest";
import {
  ADMIN_AUTH_KEY,
  ADMIN_FAILED_ATTEMPTS_KEY,
  ADMIN_LOCKED_UNTIL_KEY,
  ADMIN_MAX_FAILED_ATTEMPTS,
  ADMIN_LOCKOUT_MS,
  attemptAdminPasscode,
  getAdminAuthSnapshot,
} from "@shared/adminAuth";

function createMemoryStorage(initialValues: Record<string, string> = {}) {
  const values = new Map(Object.entries(initialValues));

  return {
    getItem(key: string) {
      return values.has(key) ? values.get(key)! : null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

describe("adminAuth", () => {
  it("locks admin login after five failed attempts", () => {
    const storage = createMemoryStorage();
    const now = 1_700_000_000_000;

    for (let index = 0; index < ADMIN_MAX_FAILED_ATTEMPTS; index += 1) {
      const result = attemptAdminPasscode(storage, "wrong-passcode", now + index);
      if (index < ADMIN_MAX_FAILED_ATTEMPTS - 1) {
        expect(result.status).toBe("failure");
      }
    }

    const snapshot = getAdminAuthSnapshot(storage, now);
    expect(snapshot.isLocked).toBe(true);
    expect(snapshot.remainingAttempts).toBe(0);
    expect(Number(storage.getItem(ADMIN_LOCKED_UNTIL_KEY))).toBe(now + ADMIN_LOCKOUT_MS + 4);
    expect(storage.getItem(ADMIN_FAILED_ATTEMPTS_KEY)).toBe(String(ADMIN_MAX_FAILED_ATTEMPTS));
    expect(storage.getItem(ADMIN_AUTH_KEY)).toBeNull();
  });

  it("unlocks after one hour and allows the correct passcode again", () => {
    const storage = createMemoryStorage();
    const lockedAt = 1_700_000_000_000;

    for (let index = 0; index < ADMIN_MAX_FAILED_ATTEMPTS; index += 1) {
      attemptAdminPasscode(storage, "wrong-passcode", lockedAt + index);
    }

    const lockedSnapshot = getAdminAuthSnapshot(storage, lockedAt + ADMIN_LOCKOUT_MS - 1);
    expect(lockedSnapshot.isLocked).toBe(true);

    const expiredSnapshot = getAdminAuthSnapshot(storage, lockedAt + ADMIN_LOCKOUT_MS + ADMIN_MAX_FAILED_ATTEMPTS);
    expect(expiredSnapshot.isLocked).toBe(false);
    expect(expiredSnapshot.remainingAttempts).toBe(ADMIN_MAX_FAILED_ATTEMPTS);

    const success = attemptAdminPasscode(storage, "safeher2026", lockedAt + ADMIN_LOCKOUT_MS + ADMIN_MAX_FAILED_ATTEMPTS);
    expect(success.status).toBe("success");
    expect(success.snapshot.isAuthorized).toBe(true);
    expect(storage.getItem(ADMIN_AUTH_KEY)).toBe("true");
    expect(storage.getItem(ADMIN_LOCKED_UNTIL_KEY)).toBeNull();
  });
});