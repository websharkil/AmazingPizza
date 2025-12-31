import { Theme } from "./theme.js";

// Button container with a rounded background and centered label.
export function createButton(scene, options = {}) {
  const {
    x = 0,
    y = 0,
    width = 220,
    height = 70,
    label = "",
    onClick = null,
    background = Theme.colors.buttonBg,
    stroke = Theme.colors.buttonStroke,
    radius = Theme.ui.cornerRadius,
    textVariant = "label",
    hitPadding = Theme.ui.hitPadding,
  } = options;

  const container = scene.add.container(x, y);
  const hitZone = scene.add.zone(0, 0, width + hitPadding * 2, height + hitPadding * 2);
  hitZone.setOrigin(0.5, 0.5);
  hitZone.setInteractive({ useHandCursor: true });
  const bg = scene.add.graphics();
  bg.fillStyle(background, 1);
  bg.lineStyle(4, stroke, 1);
  bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
  bg.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
  bg.setDepth(0);

  const textStyle = Theme.text[textVariant] || Theme.text.label;
  const labelStyle = {
    fontFamily: Theme.fontFamily,
    fontSize: `${textStyle.fontSize}px`,
    color: textStyle.color,
  };
  if (textStyle.stroke) {
    labelStyle.stroke = textStyle.stroke;
    labelStyle.strokeThickness = textStyle.strokeThickness || 0;
  }
  if (textStyle.fontStyle) {
    labelStyle.fontStyle = textStyle.fontStyle;
  }
  const labelText = scene.add.text(0, 0, label, labelStyle);
  labelText.setOrigin(0.5, 0.5);
  labelText.setDepth(1);

  container.add([hitZone, bg, labelText]);
  container.sort("depth");

  const state = { enabled: true, callback: onClick };

  hitZone.on("pointerdown", () => {
    if (!state.enabled) {
      return;
    }
    container.setScale(0.97);
  });

  hitZone.on("pointerup", (pointer) => {
    if (!state.enabled) {
      return;
    }
    container.setScale(1);
    if (state.callback) {
      state.callback(pointer);
    }
  });

  hitZone.on("pointerout", () => {
    container.setScale(1);
  });

  container.setEnabled = (enabled) => {
    state.enabled = Boolean(enabled);
    container.setAlpha(state.enabled ? 1 : 0.55);
    if (hitZone.input) {
      hitZone.input.enabled = state.enabled;
      hitZone.input.useHandCursor = state.enabled;
    }
  };

  container.setLabel = (nextLabel) => {
    labelText.setText(nextLabel);
  };

  container.onClick = (nextCallback) => {
    state.callback = nextCallback;
  };

  return container;
}
