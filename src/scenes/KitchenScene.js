import { GAME_HEIGHT, GAME_WIDTH } from "../constants.js";
import { GameState } from "../state.js";
import { createButton } from "../ui/UIButton.js";
import { createLabel } from "../ui/UILabel.js";
import { Theme } from "../ui/theme.js";
import { applyCoverLayout, screenToUi } from "../ui/layout.js";

function frameIndex(row, col, cols = 4) {
  return row * cols + col;
}

class KitchenScene extends Phaser.Scene {
  constructor() {
    super({ key: "KitchenScene" });
  }

  preload() {
    this.load.image("kitchen_bg", "assets/bg/kitchen_bg.png");
    this.load.spritesheet("bowls-sprite", "assets/ingredients/bowls-sprite.png", {
      frameWidth: 320,
      frameHeight: 230,
    });
    this.load.image("dough_base", "assets/ingredients/dough.png");
    this.load.image("dough_baked", "assets/ingredients/dough-baked.png");
    this.load.image("ladle_cursor", "assets/ingredients/sauce_cursor.png");
    this.load.image("cheese_cursor", "assets/ingredients/cheese_cursor.png");
    this.load.image("olives_cursor", "assets/ingredients/olives_cursor.png");
    this.load.spritesheet("sprinkle-sprite", "assets/ingredients/sprinkle-sprite.png", {
      frameWidth: 190,
      frameHeight: 90,
    });
    this.load.image("cutter_tool", "assets/ingredients/cutter.png");
  }

  create() {
    const bg = this.add.image(0, 0, "kitchen_bg");
    const uiRoot = this.add.container(0, 0);
    applyCoverLayout(this, bg, uiRoot);
    this.ui = { root: uiRoot };
    this.isPizzaOnBench = true;
    this.resetPizzaState();

    // draw bowls
    const bowlY = 507;
    const bowlX = 110;
    const bowlKeys = ["bowl_sauce", "bowl_cheese", "bowl_olives"];
    const bowlFrames = bowlKeys.map((_, index) => frameIndex(0, index));
    const bowlSize = 160;
    const bowlIcons = {};

    bowlKeys.forEach((key, index) => {
      const icon = this.add.image(bowlX + bowlSize * index, bowlY, "bowls-sprite", bowlFrames[index]);
      icon.setScale(bowlSize / icon.width);
      uiRoot.add(icon);
      bowlIcons[key] = icon;
      this.attachHoverCursorReset(icon);
    });

    this.pizzaContainer = this.add.container(0, 0);
    uiRoot.add(this.pizzaContainer);

    const dough = this.add.image(878, 658, "dough_base");
    const doughSize = 464;
    dough.setScale(doughSize / dough.width);
    this.pizzaContainer.add(dough);
    this.dough = dough;

    this.doughBounds = this.getSauceBounds(dough);
    this.setupSauceInteraction(uiRoot, dough, bowlIcons["bowl_sauce"]);
    this.setupSprinkleInteractions(uiRoot, bowlIcons);

    this.scale.on("resize", () => {
      this.doughBounds = this.getSauceBounds(this.dough);
    });

    this.ui.ovenButton = createButton(this, {
      width: 260,
      height: 90,
      label: "To the oven",
      textVariant: "label",
      onClick: () => {
        this.sendPizzaToOven();
      },
    });
    uiRoot.add(this.ui.ovenButton);
    this.attachHoverCursorReset(this.ui.ovenButton);

    const layoutButtons = () => {
      const target = screenToUi(uiRoot, this.scale.width * 0.5, this.scale.height * 0.92);
      this.ui.ovenButton.setPosition(target.x, target.y);
    };
    layoutButtons();
    this.scale.on("resize", layoutButtons);

    this.cutterPickedUp = false;
    this.returnedPizzaReady = false;
    this.cutterTool = this.createCutterTool();
    this.cutterCursor = this.createCutterCursor();
    this.cutGuides = this.createCutGuides();
    this.setupCutterInput();
    this.cutterAnimating = false;

    this.ui.scoreLabel = this.createScoreLabel();
    this.updateUI();
  }

  update() {
    // Game loop updates will go here.
  }

  updateUI() {
    if (this.ui && this.ui.ovenButton) {
      this.ui.ovenButton.setEnabled(this.isPizzaOnBench);
    }
  }

  // Sauce painting input and cursor management.
  setupSauceInteraction(uiRoot, dough, sauceIcon) {
    this.sauceActive = false;
    this.saucePainting = false;
    this.sauceBlobSize = 36;
    this.sauceIconRef = sauceIcon;

    this.sauceLayers = this.createSauceLayers(dough);
    this.sauceLayerIndex = 0;
    this.sauceStamp = this.make.graphics({ x: 0, y: 0, add: false });
    this.ladleCursor = this.createLadleCursor(uiRoot);

    sauceIcon.setInteractive({ useHandCursor: true });
    sauceIcon.on("pointerdown", (pointer) => {
      if (!this.isPizzaOnBench) {
        return;
      }
      if (this.sauceActive) {
        this.deactivateSauce();
        return;
      }

      this.deactivateSprinkle();
      this.sauceActive = true;
      sauceIcon.setTint(0xffe27a);
      this.input.setDefaultCursor("none");
      this.ladleCursor.setVisible(true);
      const local = this.toUiLocal(uiRoot, pointer);
      this.ladleCursor.setPosition(local.x, local.y);
      this.ui.root.bringToTop(this.ladleCursor);
    });

    this.input.on("pointerdown", (pointer) => {
      if (!this.sauceActive || !this.isPizzaOnBench) {
        return;
      }
      const local = this.toUiLocal(uiRoot, pointer);
      this.ladleCursor.setPosition(local.x, local.y);
      this.ui.root.bringToTop(this.ladleCursor);
      const tip = this.getLadleTip();
      if (this.isOnDough(tip.x, tip.y)) {
        this.saucePainting = true;
        this.stampSauce(tip.x, tip.y, dough);
      }
    });

    this.input.on("pointermove", (pointer) => {
      if (!this.sauceActive || !this.isPizzaOnBench) {
        return;
      }
      const local = this.toUiLocal(uiRoot, pointer);
      this.ladleCursor.setPosition(local.x, local.y);
      this.ui.root.bringToTop(this.ladleCursor);
      const tip = this.getLadleTip();
      if (this.saucePainting && pointer.isDown && this.isOnDough(tip.x, tip.y)) {
        this.stampSauce(tip.x, tip.y, dough);
      }
    });

    this.input.on("pointerup", () => {
      this.saucePainting = false;
    });
  }

  // Generic sprinkle setup for ingredients
  setupSprinkleInteractions(uiRoot, bowlIcons) {
    this.sprinkleActive = false;
    this.sprinklePainting = false;
    this.sprinkleIconRef = null;
    this.sprinkleConfig = null;
    this.lastSprinkleStampTime = 0;
    this.sprinkleCursor = this.createSprinkleCursor(uiRoot, "cheese_cursor", 60);

    this.sprinkleConfigs = [
      {
        icon: bowlIcons["bowl_cheese"],
        ingredient: "cheese",
        cursorKey: "cheese_cursor",
        cursorWidth: 120,
        sprinkleFrames: [frameIndex(0, 0), frameIndex(0, 1), frameIndex(0, 2), frameIndex(0, 3)],
        sprinkleWidth: 80,
      },
      {
        icon: bowlIcons["bowl_olives"],
        ingredient: "olives",
        cursorKey: "olives_cursor",
        cursorWidth: 120,
        sprinkleFrames: [frameIndex(1, 0), frameIndex(1, 1), frameIndex(1, 2), frameIndex(1, 3)],
        sprinkleWidth: 80,
      },
    ];

    this.sprinkleConfigs.forEach((config) => {
      config.icon.setInteractive({ useHandCursor: true });
      config.icon.on("pointerdown", (pointer) => {
        if (!this.isPizzaOnBench) {
          return;
        }
        if (this.sprinkleActive && this.sprinkleIconRef === config.icon) {
          this.deactivateSprinkle();
          return;
        }

        this.deactivateSauce();
        this.activateSprinkle(config, pointer);
      });
    });

    this.input.on("pointerdown", (pointer) => {
      if (!this.sprinkleActive || !this.isPizzaOnBench) {
        return;
      }
      const local = this.toUiLocal(uiRoot, pointer);
      this.sprinkleCursor.setPosition(local.x, local.y);
      this.ui.root.bringToTop(this.sprinkleCursor);
      const tip = this.getSprinkleTip();
      if (this.isOnDough(tip.x, tip.y)) {
        this.sprinklePainting = true;
        this.stampSprinkle(tip.x, tip.y);
      }
    });

    this.input.on("pointermove", (pointer) => {
      if (!this.sprinkleActive || !this.isPizzaOnBench) {
        return;
      }
      const local = this.toUiLocal(uiRoot, pointer);
      this.sprinkleCursor.setPosition(local.x, local.y);
      this.ui.root.bringToTop(this.sprinkleCursor);
      const tip = this.getSprinkleTip();
      if (this.sprinklePainting && pointer.isDown && this.isOnDough(tip.x, tip.y)) {
        this.stampSprinkle(tip.x, tip.y);
      }
    });

    this.input.on("pointerup", () => {
      this.sprinklePainting = false;
    });
  }

  deactivateSauce() {
    if (!this.sauceActive) {
      return;
    }
    this.sauceActive = false;
    this.saucePainting = false;
    if (this.sauceIconRef) {
      this.sauceIconRef.clearTint();
    }
    if (this.sprinkleIconRef) {
      this.sprinkleIconRef.clearTint();
    }
    this.input.setDefaultCursor("default");
    if (this.ladleCursor) {
      this.ladleCursor.setVisible(false);
    }
  }

  // Activate a selected bowl
  activateSprinkle(config, pointer) {
    this.sprinkleActive = true;
    this.sprinklePainting = false;
    this.sprinkleConfig = config;
    this.sprinkleIconRef = config.icon;
    this.sprinkleConfigs.forEach((entry) => {
      if (entry.icon !== config.icon) {
        entry.icon.clearTint();
      }
    });
    config.icon.setTint(0xffe27a);
    this.input.setDefaultCursor("none");
    this.sprinkleCursor.setTexture(config.cursorKey);
    this.sprinkleCursor.setScale(config.cursorWidth / this.sprinkleCursor.width);
    this.sprinkleCursor.setVisible(true);
    const local = this.toUiLocal(this.ui.root, pointer);
    this.sprinkleCursor.setPosition(local.x, local.y);
    this.ui.root.bringToTop(this.sprinkleCursor);
  }

  // Clear sprinkle selection and cursor.
  deactivateSprinkle() {
    if (!this.sprinkleActive) {
      return;
    }
    this.sprinkleActive = false;
    this.sprinklePainting = false;
    if (this.sprinkleIconRef) {
      this.sprinkleIconRef.clearTint();
    }
    this.input.setDefaultCursor("default");
    if (this.sprinkleCursor) {
      this.sprinkleCursor.setVisible(false);
    }
  }

  // Render texture layers for sauce buildup.
  createSauceLayers(dough) {
    const size = Math.max(dough.displayWidth, dough.displayHeight);
    const alphas = [0.4, 0.6, 0.8];
    const layers = [];

    alphas.forEach((alpha) => {
      const layer = this.add.renderTexture(dough.x, dough.y, size, size);
      layer.setOrigin(0.5, 0.5);
      layer.setAlpha(alpha);
      this.pizzaContainer.add(layer);
      layers.push(layer);
    });

    return layers;
  }

  // Custom cursor for sauce ladle.
  createLadleCursor(uiRoot) {
    const ladle = this.add.image(0, 0, "ladle_cursor");
    ladle.setOrigin(0, 1);
    ladle.setScale(0.8);
    ladle.setVisible(false);
    ladle.setDepth(1000);
    uiRoot.add(ladle);
    return ladle;
  }

  // Custom cursor for sprinkle ingredients.
  createSprinkleCursor(uiRoot, textureKey, targetWidth) {
    const bunch = this.add.image(0, 0, textureKey);
    bunch.setOrigin(0, 1);
    bunch.setScale(targetWidth / bunch.width);
    bunch.setVisible(false);
    bunch.setDepth(1000);
    uiRoot.add(bunch);
    return bunch;
  }

  // Convert pointer coordinates into UI container space.
  toUiLocal(uiRoot, pointer) {
    const x = (pointer.worldX - uiRoot.x) / uiRoot.scaleX;
    const y = (pointer.worldY - uiRoot.y) / uiRoot.scaleY;
    return { x, y };
  }

  // Constrain toppings to the dough ellipse.
  isOnDough(x, y) {
    const ellipse = new Phaser.Geom.Ellipse(
      this.doughBounds.cx,
      this.doughBounds.cy,
      this.doughBounds.rx * 2,
      this.doughBounds.ry * 2
    );
    return Phaser.Geom.Ellipse.Contains(ellipse, x, y);
  }

  getLadleTip() {
    return {
      x: this.ladleCursor.x,
      y: this.ladleCursor.y,
    };
  }

  getSprinkleTip() {
    return {
      x: this.sprinkleCursor.x,
      y: this.sprinkleCursor.y,
    };
  }

  // Convert dough image coordinates into scene space for hit testing.
  getSauceBounds(dough) {
    const centerXRatio = 0.5;
    const centerYRatio = 0.51;
    const radiusXRatio = 0.32;
    const radiusYRatio = 0.18;

    return {
      cx: dough.x + (centerXRatio - 0.5) * dough.displayWidth,
      cy: dough.y + (centerYRatio - 0.5) * dough.displayHeight - 20,
      rx: dough.displayWidth * radiusXRatio,
      ry: dough.displayHeight * radiusYRatio,
    };
  }

  // Stamp sauce texture for a thicker spread look.
  stampSauce(x, y, dough) {
    const size = Math.max(dough.displayWidth, dough.displayHeight);
    const originX = dough.x - size * 0.5;
    const originY = dough.y - size * 0.5;
    const localX = x - originX;
    const localY = y - originY;

    const baseSize = this.sauceBlobSize;
    const stampW = baseSize * Phaser.Math.FloatBetween(0.7, 1.2);
    const stampH = baseSize * Phaser.Math.FloatBetween(0.7, 1.2);
    const drawX = localX - stampW * 0.5;
    const drawY = localY - stampH * 0.5;

    const stamp = this.sauceStamp;
    stamp.clear();
    stamp.fillStyle(this.randomizedSauceColor(), 1);
    stamp.fillEllipse(stampW * 0.5, stampH * 0.5, stampW, stampH);
    this.addHerbSpeckles(stamp, stampW, stampH);

    const layer = this.sauceLayers[this.sauceLayerIndex];
    this.pizzaContainer.bringToTop(layer);
    layer.draw(stamp, drawX, drawY);
    this.sauceLayerIndex = (this.sauceLayerIndex + 1) % this.sauceLayers.length;
    this.registerIngredient("sauce");
  }

  // Drop a random sprinkle image at the cursor tip.
  stampSprinkle(x, y) {
    const now = this.time.now;
    if (now - this.lastSprinkleStampTime < 40) {
      return;
    }
    this.lastSprinkleStampTime = now;

    const frame = Phaser.Utils.Array.GetRandom(this.sprinkleConfig.sprinkleFrames);
    const sprinkle = this.add.image(x, y, "sprinkle-sprite", frame);
    sprinkle.setScale(this.sprinkleConfig.sprinkleWidth / sprinkle.width);
    sprinkle.setRotation(Phaser.Math.FloatBetween(-0.4, 0.4));
    this.pizzaContainer.add(sprinkle);
    this.pizzaContainer.bringToTop(sprinkle);
    if (this.sprinkleConfig && this.sprinkleConfig.ingredient) {
      this.registerIngredient(this.sprinkleConfig.ingredient);
    }
  }

  // Slightly vary sauce color for a natural look.
  randomizedSauceColor() {
    const base = Phaser.Display.Color.IntegerToColor(0xb3261e);
    const variance = 18;
    const r = Phaser.Math.Clamp(base.red + Phaser.Math.Between(-variance, variance), 0, 255);
    const g = Phaser.Math.Clamp(base.green + Phaser.Math.Between(-variance, variance), 0, 255);
    const b = Phaser.Math.Clamp(base.blue + Phaser.Math.Between(-variance, variance), 0, 255);
    return Phaser.Display.Color.GetColor(r, g, b);
  }

  // Add tiny herb speckles to sauce stamps.
  addHerbSpeckles(stamp, width, height) {
    const rx = width * 0.5;
    const ry = height * 0.5;
    const colors = [0x2f5d34, 0x4f7a3a, 0x6b4a2b, 0x3f3a2a];
    const speckCount = Phaser.Math.Between(4, 7);

    for (let i = 0; i < speckCount; i += 1) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const radius = Math.sqrt(Math.random());
      const sx = width * 0.5 + Math.cos(angle) * rx * radius;
      const sy = height * 0.5 + Math.sin(angle) * ry * radius;
      const size = Phaser.Math.FloatBetween(1, 2.2);
      stamp.fillStyle(colors[Phaser.Math.Between(0, colors.length - 1)], 0.6);
      stamp.fillCircle(sx, sy, size);
    }
  }

  // Score text display
  createScoreLabel() {
    const margin = Theme.ui.margin;
    const text = createLabel(this, "", "title");
    text.setOrigin(0, 0);
    text.setDepth(1500);
    text.setScrollFactor(0);
    text.setVisible(false);
    text.setPosition(margin, margin);
    this.scale.on("resize", () => {
      text.setPosition(margin, margin);
    });
    return text;
  }

  resetPizzaState() {
    GameState.madePizza = {
      ingredients: new Set(),
      baked: false,
      cut: false,
      boxed: false,
      score: 0,
    };
  }

  registerIngredient(name) {
    if (!name || !GameState.madePizza) {
      return;
    }
    GameState.madePizza.ingredients.add(name);
  }

  calculatePizzaScore() {
    const order = (GameState.currentOrder && GameState.currentOrder.ingredients) || [];
    const orderSet = new Set(order);
    const added = GameState.madePizza.ingredients;
    let correct = 0;
    let wrong = 0;

    added.forEach((ingredient) => {
      if (orderSet.has(ingredient)) {
        correct += 1;
      } else {
        wrong += 1;
      }
    });

    const rawScore = (correct - wrong) * 10;
    return Math.max(0, rawScore);
  }

  showPizzaScore() {
    const score = this.calculatePizzaScore();
    GameState.madePizza.score = score;
    if (!this.ui.scoreLabel) {
      return;
    }
    this.ui.scoreLabel.setText(`Score: ${score}`);
    this.ui.scoreLabel.setVisible(true);
    this.ui.root.bringToTop(this.ui.scoreLabel);
  }

  //#region Pizza cutter
  createCutterTool() {
    const targetWidth = 140;
    const tool = this.add.image(1160, 610, "cutter_tool");
    tool.setScale(targetWidth / tool.width);
    tool.setVisible(false);
    tool.setActive(false);
    tool.setInteractive({ useHandCursor: true });
    tool.disableInteractive();
    tool.on("pointerdown", (pointer) => {
      this.pickUpCutter(pointer);
    });
    this.ui.root.add(tool);
    return tool;
  }

  createCutterCursor() {
    const targetWidth = 140;
    const cursor = this.add.image(0, 0, "cutter_tool");
    cursor.setOrigin(0.1, 0.5);
    cursor.setScale(targetWidth / cursor.width);
    cursor.setVisible(false);
    cursor.setDepth(1200);
    this.ui.root.add(cursor);
    return cursor;
  }

  setupCutterInput() {
    this.input.on("pointermove", (pointer) => {
      if (!this.cutterPickedUp) {
        return;
      }
      if (this.cutterAnimating) {
        return;
      }
      const local = this.toUiLocal(this.ui.root, pointer);
      this.cutterCursor.setPosition(local.x, local.y);
      this.ui.root.bringToTop(this.cutterCursor);

      if (!this.returnedPizzaReady || !this.isPointerOnReturnedPizza(local.x, local.y)) {
        this.hideCutGuides();
        return;
      }

      const index = this.pickCutGuideIndex(local.x, local.y);
      this.showCutGuide(index);
    });

    this.input.on("pointerdown", (pointer) => {
      if (!this.cutterPickedUp) {
        return;
      }
      const local = this.toUiLocal(this.ui.root, pointer);
      if (!this.returnedPizzaReady || !this.isPointerOnReturnedPizza(local.x, local.y)) {
        return;
      }
      const index = this.pickCutGuideIndex(local.x, local.y);
      if (index === -1) {
        return;
      }
      if (this.cutterAnimating) {
        return;
      }
      this.playCutAnimation(index);
    });
  }

  pickUpCutter(pointer) {
    if (!this.cutterTool || !this.cutterTool.visible) {
      return;
    }
    this.cutterPickedUp = true;
    this.cutterTool.setVisible(false);
    this.cutterTool.setActive(false);
    this.cutterTool.disableInteractive();
    this.input.setDefaultCursor("none");
    this.cutterCursor.setVisible(true);
    const local = this.toUiLocal(this.ui.root, pointer);
    this.cutterCursor.setPosition(local.x, local.y);
    this.ui.root.bringToTop(this.cutterCursor);
  }

  showCutterTool() {
    if (!this.cutterTool || this.cutterPickedUp) {
      return;
    }
    this.cutterTool.setVisible(true);
    this.cutterTool.setActive(true);
    this.cutterTool.setInteractive({ useHandCursor: true });
    this.ui.root.bringToTop(this.cutterTool);
  }

  createCutGuides() {
    const angles = [Math.PI / 2, Math.PI / 6, -Math.PI / 6];
    return angles.map((angle) => {
      const guide = this.add.graphics();
      guide.setVisible(false);
      guide.setDepth(900);
      this.ui.root.add(guide);
      return { guide, angle, available: true, used: false };
    });
  }

  updateCutGuideLayout() {
    if (!this.returnedPizza || !this.returnedDough) {
      return;
    }
    const centerX = this.returnedPizza.x + this.returnedDough.x;
    const centerY = this.returnedPizza.y + this.returnedDough.y;
    this.cutGuides.forEach((entry) => {
      const length = this.getGuideLength(entry.angle);
      entry.guide.clear();
      if (entry.used) {
        entry.guide.lineStyle(6, 0x2f2517, 0.95);
        this.drawSolidLine(entry.guide, length);
      } else {
        entry.guide.lineStyle(4, 0xffffff, 0.9);
        this.drawDashedLine(entry.guide, length, 18, 12);
      }
      entry.guide.setPosition(centerX, centerY);
      entry.guide.setRotation(entry.angle);
    });
  }

  showCutGuide(index) {
    if (index === -1 || !this.cutGuides[index] || !this.cutGuides[index].available) {
      this.hideCutGuides();
      return;
    }
    this.cutGuides.forEach((entry, idx) => {
      if (entry.used) {
        entry.guide.setVisible(true);
        return;
      }
      entry.guide.setVisible(entry.available && idx === index);
      if (idx === index && entry.available) {
        this.ui.root.bringToTop(entry.guide);
      }
    });
  }

  hideCutGuides() {
    this.cutGuides.forEach((entry) => {
      if (!entry.used) {
        entry.guide.setVisible(false);
      }
    });
  }

  pickCutGuideIndex(x, y) {
    const centerX = this.returnedPizza.x + this.returnedDough.x;
    const centerY = this.returnedPizza.y + this.returnedDough.y;
    const angle = Phaser.Math.Angle.Normalize(Phaser.Math.Angle.Between(centerX, centerY, x, y));
    const candidates = [Math.PI / 2, Math.PI / 3, (2 * Math.PI) / 3];
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    candidates.forEach((candidate, index) => {
      if (!this.cutGuides[index] || !this.cutGuides[index].available) {
        return;
      }
      const forward = Math.abs(Phaser.Math.Angle.ShortestBetween(angle, candidate));
      const flipped = Math.abs(
        Phaser.Math.Angle.ShortestBetween(angle, Phaser.Math.Angle.Normalize(candidate + Math.PI))
      );
      const distance = Math.min(forward, flipped);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    return bestIndex;
  }

  isPointerOnReturnedPizza(x, y) {
    if (!this.returnedPizza || !this.returnedDough) {
      return false;
    }
    const centerX = this.returnedPizza.x + this.returnedDough.x;
    const centerY = this.returnedPizza.y + this.returnedDough.y;
    const rx = this.returnedDough.displayWidth * 0.48;
    const ry = this.returnedDough.displayHeight * 0.32;
    const ellipse = new Phaser.Geom.Ellipse(centerX, centerY, rx * 2, ry * 2);
    return Phaser.Geom.Ellipse.Contains(ellipse, x, y);
  }

  drawDashedLine(graphics, length, dashLength, gapLength) {
    const half = length * 0.5;
    let x = -half;
    graphics.beginPath();
    while (x < half) {
      const dashEnd = Math.min(x + dashLength, half);
      graphics.moveTo(x, 0);
      graphics.lineTo(dashEnd, 0);
      x = dashEnd + gapLength;
    }
    graphics.strokePath();
  }

  drawSolidLine(graphics, length) {
    graphics.strokeLineShape(new Phaser.Geom.Line(-length / 2, 0, length / 2, 0));
  }

  getGuideLength(angle) {
    const rx = this.returnedDough.displayWidth * 0.48;
    const ry = this.returnedDough.displayHeight * 0.32;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const denom = Math.sqrt((cos * cos) / (rx * rx) + (sin * sin) / (ry * ry));
    if (!denom) {
      return this.returnedDough.displayWidth * 0.9;
    }
    return (2 / denom) * 0.9;
  }

  markGuideUsed(index) {
    const entry = this.cutGuides[index];
    if (!entry || entry.used) {
      return;
    }
    entry.available = false;
    entry.used = true;
    entry.guide.clear();
    entry.guide.lineStyle(6, 0xe37827, 0.95);
    this.drawSolidLine(entry.guide, this.getGuideLength(entry.angle));
    entry.guide.setPosition(this.returnedPizza.x + this.returnedDough.x, this.returnedPizza.y + this.returnedDough.y);
    entry.guide.setRotation(entry.angle);
    entry.guide.setVisible(true);
    this.ui.root.bringToTop(entry.guide);
  }

  playCutAnimation(index) {
    const entry = this.cutGuides[index];
    if (!entry || entry.used || !this.returnedPizza || !this.returnedDough) {
      return;
    }
    this.cutterAnimating = true;
    this.cutterCursor.setVisible(false);

    const length = this.getGuideLength(entry.angle);
    const centerX = this.returnedPizza.x + this.returnedDough.x;
    const centerY = this.returnedPizza.y + this.returnedDough.y;
    const dirX = Math.cos(entry.angle);
    const dirY = Math.sin(entry.angle);
    const startX = centerX - dirX * (length * 0.5);
    const startY = centerY - dirY * (length * 0.5);
    const endX = centerX + dirX * (length * 0.5);
    const endY = centerY + dirY * (length * 0.5);

    const prevOriginX = this.cutterCursor.originX;
    const prevOriginY = this.cutterCursor.originY;
    const prevRotation = this.cutterCursor.rotation;

    this.cutterCursor.setOrigin(0, 1);
    this.cutterCursor.setRotation(entry.angle);
    this.cutterCursor.setPosition(startX, startY);
    this.cutterCursor.setVisible(true);
    this.ui.root.bringToTop(this.cutterCursor);

    this.tweens.add({
      targets: this.cutterCursor,
      x: endX,
      y: endY,
      duration: 500,
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.cutterCursor.setOrigin(prevOriginX, prevOriginY);
        this.cutterCursor.setRotation(prevRotation);
        const pointer = this.input.activePointer;
        const local = this.toUiLocal(this.ui.root, pointer);
        this.cutterCursor.setPosition(local.x, local.y);
        this.cutterCursor.setVisible(true);
        this.cutterAnimating = false;
        this.markGuideUsed(index);
      },
    });
  }

  //#endregion

  attachHoverCursorReset(target) {
    target.on("pointerover", () => {
      if (!this.sauceActive && !this.sprinkleActive) {
        return;
      }
      this.input.setDefaultCursor("default");
      if (this.ladleCursor) {
        this.ladleCursor.setVisible(false);
      }
      if (this.sprinkleCursor) {
        this.sprinkleCursor.setVisible(false);
      }
    });

    target.on("pointerout", () => {
      if (this.sauceActive) {
        this.input.setDefaultCursor("none");
        if (this.ladleCursor) {
          this.ladleCursor.setVisible(true);
        }
        return;
      }
      if (this.sprinkleActive) {
        this.input.setDefaultCursor("none");
        if (this.sprinkleCursor) {
          this.sprinkleCursor.setVisible(true);
        }
      }
    });
  }

  //#region Oven animation
  // Capture pizza snapshot and animate on conveyor belt.
  sendPizzaToOven() {
    if (!this.isPizzaOnBench) {
      return;
    }
    this.isPizzaOnBench = false;
    this.deactivateSauce();
    this.deactivateSprinkle();
    this.showPizzaScore();
    this.updateUI();

    // create snapshot of pizza
    const bounds = this.pizzaContainer.getBounds();
    const localX = (bounds.x - this.ui.root.x) / this.ui.root.scaleX;
    const localY = (bounds.y - this.ui.root.y) / this.ui.root.scaleY;
    const width = Math.ceil(bounds.width / this.ui.root.scaleX);
    const height = Math.ceil(bounds.height / this.ui.root.scaleY);
    const wasDoughVisible = this.dough.visible;
    this.dough.setVisible(false);
    const toppingsSnapshot = this.add.renderTexture(0, 0, width, height);
    toppingsSnapshot.draw(this.pizzaContainer, -localX, -localY);
    toppingsSnapshot.setOrigin(0, 0);
    toppingsSnapshot.setPosition(0, 0);
    this.dough.setVisible(wasDoughVisible);

    const doughOffsetX = this.dough.x - localX;
    const doughOffsetY = this.dough.y - localY;
    const benchX = localX;
    const benchY = localY;
    const doughWidth = this.dough.displayWidth;
    const doughHeight = this.dough.displayHeight;

    const rawDough = this.add.image(doughOffsetX, doughOffsetY, "dough_base");
    rawDough.setDisplaySize(doughWidth, doughHeight);

    const bakedDough = this.add.image(doughOffsetX, doughOffsetY, "dough_baked");
    bakedDough.setDisplaySize(doughWidth, doughHeight);
    bakedDough.setAlpha(0);

    // place it on the belt
    const beltScale = 0.55;
    const beltPizza = this.add.container(350, 245);
    beltPizza.setScale(beltScale);
    beltPizza.add([rawDough, bakedDough, toppingsSnapshot]);
    this.ui.root.add(beltPizza);
    this.returnedPizza = beltPizza;
    this.returnedDough = bakedDough;
    this.returnedPizzaReady = false;

    // shaking effect
    const startY = beltPizza.y;
    let shakeTween = null;
    this.time.delayedCall(2000, () => {
      shakeTween = this.tweens.add({
        targets: beltPizza,
        y: startY + 2,
        duration: 260,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });

    // travel on conveyor belt
    const travelDelay = 1000;
    const travelDuration = 7000;
    this.tweens.add({
      targets: beltPizza,
      x: 1220,
      duration: travelDuration,
      delay: travelDelay,
      ease: "Sine.easeInOut",
      onComplete: () => {
        if (shakeTween) {
          shakeTween.stop();
        }
        beltPizza.setY(startY);

        // after 1s, return pizza to bench
        this.time.delayedCall(1000, () => {
          const fadeHalf = 200;
          this.tweens.add({
            targets: beltPizza,
            alpha: 0,
            duration: fadeHalf,
            ease: "Sine.easeInOut",
            onComplete: () => {
              beltPizza.setScale(1);
              beltPizza.setPosition(benchX, benchY);
              this.tweens.add({
                targets: beltPizza,
                alpha: 1,
                duration: fadeHalf,
                ease: "Sine.easeInOut",
                onComplete: () => {
                  this.returnedPizzaReady = true;
                  this.updateCutGuideLayout();
                  this.showCutterTool();
                },
              });
            },
          });
        });
      },
    });

    // color change baking effect for toppings
    const bakeStartDelay = travelDelay + 1600;
    const bakeDuration = 4900;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: bakeDuration,
      delay: bakeStartDelay,
      ease: "Sine.easeInOut",
      onUpdate: (tween) => {
        const value = tween.getValue();
        const color = Phaser.Display.Color.Interpolate.ColorWithColor(
          { r: 255, g: 255, b: 255 },
          { r: 140, g: 120, b: 100 },
          1,
          value
        );
        toppingsSnapshot.setTint(Phaser.Display.Color.GetColor(color.r, color.g, color.b));
      },
    });

    // dough swap effect
    const doughSwapDelay = travelDelay + Math.round(travelDuration * 0.4);
    const doughSwapDuration = 1200;
    this.tweens.add({
      targets: rawDough,
      alpha: 0.2,
      duration: doughSwapDuration,
      delay: doughSwapDelay,
      ease: "Sine.easeInOut",
    });
    this.tweens.add({
      targets: bakedDough,
      alpha: 1,
      duration: doughSwapDuration,
      delay: doughSwapDelay,
      ease: "Sine.easeInOut",
    });

    this.pizzaContainer.setVisible(false);
    this.pizzaContainer.setActive(false);
    if (this.ui.ovenButton) {
      this.ui.ovenButton.setVisible(false);
      this.ui.ovenButton.setActive(false);
    }
  }
}

export default KitchenScene;
