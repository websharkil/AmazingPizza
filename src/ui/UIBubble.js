import { Theme } from "./theme.js";

// Speech bubble container with optional colored text parts.
export function createBubble(scene, options = {}) {
  const container = scene.add.container(options.x || 0, options.y || 0);
  const bubble = scene.add.graphics();
  container.add(bubble);

  const fontSize = Theme.text.bubble.fontSize;
  const paddingX = Theme.ui.bubblePaddingX || Theme.ui.padding;
  const paddingY = Theme.ui.bubblePaddingY || Theme.ui.padding;
  const minWidth = Theme.ui.bubbleMinWidth || 200;
  const radius = Theme.ui.bubbleCornerRadius || Theme.ui.cornerRadius;

  let textObjects = [];

  const baseTextStyle = {
    fontFamily: Theme.fontFamily,
    fontSize: `${fontSize}px`,
  };
  if (Theme.text.bubble.fontStyle) {
    baseTextStyle.fontStyle = Theme.text.bubble.fontStyle;
  }

  const clearText = () => {
    textObjects.forEach((text) => text.destroy());
    textObjects = [];
  };

  const drawBubble = (textParts) => {
    clearText();
    const parts = Array.isArray(textParts)
      ? textParts
      : [{ text: textParts || "", color: Theme.text.bubble.color }];

    textObjects = parts.map((part) =>
      scene.add.text(0, 0, part.text, {
        ...baseTextStyle,
        color: part.color || Theme.text.bubble.color,
      })
    );

    const totalWidth = textObjects.reduce((sum, text) => sum + text.width, 0);
    const bubbleWidth = Math.max(minWidth, totalWidth + paddingX * 2);
    const bubbleHeight = fontSize + paddingY * 2;

    bubble.clear();
    bubble.lineStyle(4, Theme.colors.bubbleStroke, 1);
    bubble.fillStyle(Theme.colors.bubbleBg, 0.95);
    bubble.fillRoundedRect(-bubbleWidth / 2, -bubbleHeight / 2, bubbleWidth, bubbleHeight, radius);
    bubble.strokeRoundedRect(-bubbleWidth / 2, -bubbleHeight / 2, bubbleWidth, bubbleHeight, radius);
    bubble.fillTriangle(
      -bubbleWidth * 0.15,
      bubbleHeight / 2,
      -bubbleWidth * 0.02,
      bubbleHeight / 2,
      -bubbleWidth * 0.08,
      bubbleHeight / 2 + 22
    );
    bubble.lineStyle(4, Theme.colors.bubbleStroke, 1);
    bubble.beginPath();
    bubble.moveTo(-bubbleWidth * 0.15, bubbleHeight / 2);
    bubble.lineTo(-bubbleWidth * 0.08, bubbleHeight / 2 + 22);
    bubble.lineTo(-bubbleWidth * 0.02, bubbleHeight / 2);
    bubble.strokePath();

    let textX = -totalWidth / 2;
    textObjects.forEach((text) => {
      text.setOrigin(0, 0.5);
      text.setPosition(textX, 0);
      container.add(text);
      textX += text.width;
    });
  };

  container.setText = (nextText) => {
    drawBubble(nextText);
  };

  container.setIcons = () => {};

  if (options.textParts) {
    drawBubble(options.textParts);
  } else if (options.text !== undefined) {
    drawBubble(options.text);
  }

  return container;
}
