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

new Phaser.Game(config);
