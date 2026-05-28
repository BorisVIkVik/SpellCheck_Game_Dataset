const ALLOWED = new Set(["mobile", "desktop", "tablet", "unknown"]);

function detectFromUserAgent(userAgent) {
  const ua = typeof userAgent === "string" ? userAgent : "";
  if (!ua) return "unknown";

  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) {
    return "tablet";
  }
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) {
    return "tablet";
  }
  if (/Android|iPhone|iPod|Mobile|IEMobile|Opera Mini/i.test(ua)) {
    return "mobile";
  }
  if (/Windows|Macintosh|Linux|X11/i.test(ua)) {
    return "desktop";
  }

  return "unknown";
}

function normalizeDeviceType(clientValue, userAgent) {
  if (typeof clientValue === "string") {
    const value = clientValue.trim().toLowerCase();
    if (ALLOWED.has(value)) {
      return value;
    }
  }
  return detectFromUserAgent(userAgent);
}

module.exports = {
  normalizeDeviceType,
  detectFromUserAgent,
};
