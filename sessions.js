function readCookie(name) {
  const prefix = `${name}=`;
  const part = document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(prefix));
  return part ? decodeURIComponent(part.slice(prefix.length)) : "";
}

function deleteCookie(name) {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

export class SessionManager {
  constructor(apiBase = "/local-api") {
    this.apiBase = String(apiBase || "/local-api").replace(/\/$/, "");
    this.token = readCookie("user") || localStorage.getItem("spaceman.auth.token") || "";
    this.data = null;
  }

  async initialize() {
    if (!this.token) {
      this.data = this.anonymousData();
      return true;
    }
    try {
      const response = await fetch(`${this.apiBase}/auth/session`, {
        headers: { "x-session-token": this.token },
        cache: "no-store"
      });
      const result = await response.json();
      if (!response.ok || !result.authenticated || !result.user) {
        this.clear();
        this.data = this.anonymousData();
        return true;
      }
      this.data = {
        ...this.anonymousData(),
        ...result.user,
        email: result.user.email,
        email_verified: result.user.isVerified,
        is_verified: result.user.isVerified,
        is_superuser: result.user.isSuperuser
      };
      return true;
    } catch (error) {
      console.warn("SPACEMAN session validation failed:", error);
      this.data = this.anonymousData();
      return true;
    }
  }

  anonymousData() {
    return {
      email: null,
      username: null,
      email_verified: false,
      is_verified: false,
      is_superuser: false,
      last_visit: []
    };
  }

  getData() {
    return this.data || this.anonymousData();
  }

  getToken() {
    return this.token || "local-offline-session";
  }

  isLoggedIn() {
    return Boolean(this.getData().email);
  }

  isVerified() {
    return Boolean(this.getData().is_verified || this.getData().email_verified);
  }

  isSuperuser() {
    return Boolean(this.getData().is_superuser);
  }

  saveData(nextData) {
    this.data = { ...this.getData(), ...(nextData || {}) };
    localStorage.setItem("spaceman.session.state", JSON.stringify(this.data));
    return Promise.resolve(this.data);
  }

  clear() {
    this.token = "";
    this.data = this.anonymousData();
    deleteCookie("user");
    localStorage.removeItem("spaceman.auth.token");
    localStorage.removeItem("spaceman.auth.user");
  }
}
