const DEVICE_ID_KEY = "chronicles_device_id";

export function getDeviceId(): string {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return "server";
  }

  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export { DEVICE_ID_KEY };
