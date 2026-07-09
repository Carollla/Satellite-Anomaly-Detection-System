export class BlueGlobe {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.options = options;
    this.show_rotating = 1;
    this.show_trains = 0;
    this._running = false;
    this._frame = 0;
    this._ctx = canvas?.getContext?.("2d") || null;
  }

  async init() {
    if (!this.canvas || !this._ctx) return;
    this._running = true;
    this._resize();
    window.addEventListener("resize", () => this._resize(), { passive: true });
    this._draw();
  }

  showTrains(enabled) {
    this.show_trains = enabled ? 1 : 0;
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    const width = Math.max(320, Math.floor(rect.width * scale));
    const height = Math.max(180, Math.floor(rect.height * scale));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  _draw() {
    if (!this._running || !this._ctx) return;
    this._resize();
    const ctx = this._ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const t = this._frame++ / 60;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.22;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, w, h);

    const glow = ctx.createRadialGradient(cx, cy, r * .2, cx, cy, r * 2.7);
    glow.addColorStop(0, "rgba(59,130,246,.34)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.7, 0, Math.PI * 2);
    ctx.fill();

    const earth = ctx.createRadialGradient(cx - r * .35, cy - r * .35, r * .08, cx, cy, r * 1.1);
    earth.addColorStop(0, "#7dd3fc");
    earth.addColorStop(.45, "#2563eb");
    earth.addColorStop(1, "#020617");
    ctx.fillStyle = earth;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(147,197,253,.22)";
    ctx.lineWidth = Math.max(1, w / 900);
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.ellipse(cx, cy + i * r * .28, r * .92, r * .18, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const rings = [
      { rx: r * 1.55, ry: r * .48, rot: -0.55, color: "rgba(34,211,238,.72)", count: 12 },
      { rx: r * 1.82, ry: r * .56, rot: 0.72, color: "rgba(52,211,153,.62)", count: 8 },
      { rx: r * 2.30, ry: r * .68, rot: 0.08, color: "rgba(167,139,250,.56)", count: 6 },
      { rx: r * 2.72, ry: r * .76, rot: 1.35, color: "rgba(251,191,36,.52)", count: 4 }
    ];

    for (const ring of rings) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ring.rot);
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = Math.max(1, w / 1200);
      ctx.beginPath();
      ctx.ellipse(0, 0, ring.rx, ring.ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < ring.count; i += 1) {
        const a = t * .35 + (i / ring.count) * Math.PI * 2;
        const x = Math.cos(a) * ring.rx;
        const y = Math.sin(a) * ring.ry;
        ctx.fillStyle = "#e0f2fe";
        ctx.beginPath();
        ctx.arc(x, y, Math.max(2, w / 420), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.fillStyle = "rgba(226,232,240,.82)";
    ctx.font = `${Math.max(11, Math.floor(w / 58))}px Inter, system-ui, sans-serif`;
    ctx.fillText("SPACEMAN · 450 satellites", 18, h - 18);
    requestAnimationFrame(() => this._draw());
  }
}
