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
