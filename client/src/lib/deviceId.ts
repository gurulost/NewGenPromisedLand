const DEVICE_ID_KEY = "chronicles_device_id";

export function getDeviceId(): string {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return "server";
  }

  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    const randomId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    deviceId = randomId;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export { DEVICE_ID_KEY };
