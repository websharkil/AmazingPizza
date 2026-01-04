import { GAME_HEIGHT, GAME_WIDTH } from "./src/constants.js";
import CounterScene from "./src/scenes/CounterScene.js";
import KitchenScene from "./src/scenes/KitchenScene.js";

const config = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#1c1c1c",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [CounterScene, KitchenScene],
};

const game = new Phaser.Game(config);

const isMobileOrTablet =
  (typeof navigator !== "undefined" &&
    /Mobi|Android|iPad|iPhone|iPod|Tablet|Silk|Kindle/i.test(navigator.userAgent)) ||
  (typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(pointer: coarse)").matches);

if (isMobileOrTablet && typeof document !== "undefined") {
  const requestFullscreen = () => {
    const target = document.documentElement;
    if (document.fullscreenElement || !target || !target.requestFullscreen) {
      return;
    }
    target.requestFullscreen().catch(() => {});
  };

  const handleFirstGesture = () => {
    requestFullscreen();
    window.removeEventListener("pointerdown", handleFirstGesture);
    window.removeEventListener("touchend", handleFirstGesture);
  };

  window.addEventListener("pointerdown", handleFirstGesture, { once: true });
  window.addEventListener("touchend", handleFirstGesture, { once: true });
}
