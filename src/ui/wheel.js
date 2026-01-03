// --- Turning wheel with alternating wedges + radial fade ---
// Usage: const wheel = createTurningWheel(this, 400, 300, { radius: 140, spokes: 12 });

export function createTurningWheel(scene, x, y, opts = {}) {
  const radius = opts.radius ?? 420;
  const spokes = opts.spokes ?? 12;           // number of wedges
  const baseAlpha = opts.alpha ?? 1;
  const speed = opts.speed ?? 0.12;           // radians/sec
  const key = opts.key ?? `wheel_${radius}_${spokes}`;

  // 1) Draw wedges to an offscreen texture (only once)
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });

    // Alternate colors
    const c1 = opts.color1 ?? 0xF7AA67;
    const c2 = opts.color2 ?? 0xFDE4B7;

    const cx = radius, cy = radius;
    const step = (Math.PI * 2) / spokes;

    for (let i = 0; i < spokes; i++) {
      const start = i * step;
      const end = start + step;

      g.fillStyle(i % 2 === 0 ? c1 : c2, 1);

      // Wedge polygon: center -> arc endpoints
      const p0 = new Phaser.Math.Vector2(cx, cy);
      const p1 = new Phaser.Math.Vector2(cx + Math.cos(start) * radius, cy + Math.sin(start) * radius);
      const p2 = new Phaser.Math.Vector2(cx + Math.cos(end) * radius, cy + Math.sin(end) * radius);

      g.beginPath();
      g.moveTo(p0.x, p0.y);
      g.lineTo(p1.x, p1.y);
      g.lineTo(p2.x, p2.y);
      g.closePath();
      g.fillPath();
    }

    // Optional: subtle hub
    g.fillStyle(0x666666, 1);
    g.fillCircle(cx, cy, Math.max(4, radius * 0.05));

    g.generateTexture(key, radius * 2, radius * 2);
    g.destroy();
  }

  // 2) Wheel texture with baked radial alpha falloff at the edges.
  const maskedKey = `${key}_masked`;
  if (!scene.textures.exists(maskedKey)) {
    const size = radius * 2;
    const canvasTexture = scene.textures.createCanvas(maskedKey, size, size);
    const ctx = canvasTexture.context;
    const source = scene.textures.get(key).getSourceImage();
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(source, 0, 0, size, size);

    const edgeFade = typeof opts.edgeFade === "number" ? opts.edgeFade : 0;
    const gradient = ctx.createRadialGradient(radius, radius, radius * 0.1, radius, radius, radius);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(1, `rgba(255,255,255,${edgeFade})`);
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = "source-over";
    canvasTexture.refresh();
  }

  // Sprite that rotates, with baked alpha falloff at the edges.
  const wheel = scene.add.image(0, 0, maskedKey).setAlpha(baseAlpha);

  // Center icon (optional)
  const centerKey = opts.centerKey ?? "bowls-sprite";
  const centerFrame = opts.centerFrame ?? 0;
  const center = scene.add.image(0, 0, centerKey, centerFrame);
  const centerTargetWidth = radius * 0.5;
  center.setScale(centerTargetWidth / center.width);

  // Keep them together
  const container = scene.add.container(x, y, [wheel, center]);

  // Clip to a fixed rectangle mask.
  const maskSize = radius * 1.8;
  let currentScale = 1;
  const maskGraphics = scene.add.graphics();
  maskGraphics.setVisible(false);
  const mask = maskGraphics.createGeometryMask();
  const drawMask = (mx, my) => {
    maskGraphics.clear();
    maskGraphics.fillStyle(0xffffff, 1);
    const size = maskSize * currentScale;
    maskGraphics.fillRect(mx - size / 2, my - size / 2, size, size);
  };
  drawMask(x, y);
  container.setMask(mask);

  // Rotate wheel only.
  scene.events.on('update', (time, delta) => {
    wheel.rotation += speed * (delta / 1000);
  });

  // Public API
  return {
    container,
    wheelSprite: wheel,
    centerSprite: center,
    setPosition(nx, ny) {
      container.setPosition(nx, ny);
      drawMask(nx, ny);
    },
    setScale(scale) {
      currentScale = Math.max(0.01, scale);
      container.setScale(currentScale);
      drawMask(container.x, container.y);
    },
    setSpeed(radPerSec) { opts.speed = radPerSec; },
    destroy() {
      scene.events.off('update');
      container.destroy(true);
      maskGraphics.destroy();
    }
  };
}
