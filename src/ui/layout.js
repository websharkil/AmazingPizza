import { Theme } from "./theme.js";

// Layout helpers for background cover and simple anchors.
export function applyCoverLayout(scene, bgImage, uiContainer) {
  const resize = (width, height) => {
    const maxVerticalCrop = 80;
    const scale = Math.min(width / bgImage.width, (height + maxVerticalCrop * 2) / bgImage.height);
    const offsetX = (width - bgImage.width * scale) * 0.5;
    const offsetY = (height - bgImage.height * scale) * 0.5;

    bgImage.setOrigin(0, 0);
    bgImage.setScale(scale);
    bgImage.setPosition(offsetX, offsetY);

    if (uiContainer) {
      uiContainer.setScale(scale);
      uiContainer.setPosition(offsetX, offsetY);
    }
  };

  resize(scene.scale.width, scene.scale.height);
  scene.scale.on("resize", (gameSize) => {
    resize(gameSize.width, gameSize.height);
  });
}

export function topLeft(scene, margin = Theme.ui.margin) {
  return { x: margin, y: margin };
}

export function topCenter(scene, margin = Theme.ui.margin) {
  return { x: scene.scale.width * 0.5, y: margin };
}

export function bottomCenter(scene, margin = Theme.ui.margin) {
  return { x: scene.scale.width * 0.5, y: scene.scale.height - margin };
}

export function bottomRight(scene, margin = Theme.ui.margin) {
  return { x: scene.scale.width - margin, y: scene.scale.height - margin };
}

// Convert screen coordinates into UI container local space.
export function screenToUi(uiRoot, x, y) {
  return {
    x: (x - uiRoot.x) / uiRoot.scaleX,
    y: (y - uiRoot.y) / uiRoot.scaleY,
  };
}
