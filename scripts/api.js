export function getApiEndpointClient() {
  return "/local-api";
}

export function apiFetch(path, options = {}) {
  const base = getApiEndpointClient();
  const url = /^https?:\/\//i.test(path) ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, { credentials: "include", ...options });
}
