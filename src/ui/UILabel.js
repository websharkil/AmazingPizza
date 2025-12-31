import { Theme } from "./theme.js";

// Factory for themed text labels.
export function createLabel(scene, text, variant = "label") {
  const style = Theme.text[variant] || Theme.text.label;
  const labelStyle = {
    fontFamily: Theme.fontFamily,
    fontSize: `${style.fontSize}px`,
    color: style.color,
  };
  if (style.stroke) {
    labelStyle.stroke = style.stroke;
    labelStyle.strokeThickness = style.strokeThickness || 0;
  }
  if (style.fontStyle) {
    labelStyle.fontStyle = style.fontStyle;
  }
  return scene.add.text(0, 0, text, labelStyle);
}

// Top left score and pizza counters.
export function createCornerLabel(scene, text, variant = "label", offsetY = 0) {
  const label = createLabel(scene, text, variant);
  label.setOrigin(0, 0);
  label.setDepth(1500);
  label.setScrollFactor(0);
  label.setVisible(true);

  const positionLabel = () => {
    const margin = Theme.ui.margin;
    label.setPosition(margin, margin + offsetY);
  };
  positionLabel();
  scene.scale.on("resize", positionLabel);
  return label;
}
