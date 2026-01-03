import { GAME_WIDTH, INGREDIENTS } from "../constants.js";
import { GameState } from "../state.js";
import { AudioManager } from "../audio/AudioManager.js";
import { createButton } from "../ui/UIButton.js";
import { createCornerLabel } from "../ui/UILabel.js";
import { applyCoverLayout, screenToUi } from "../ui/layout.js";

// Compute a spritesheet frame index.
function frameIndex(row, col, cols = 4) {
  return row * cols + col;
}

class KitchenScene extends Phaser.Scene {
  // Create the scene instance.
  constructor() {
    super({ key: "KitchenScene" });
  }

  //#region Lifecycle
  // Load scene assets.
  preload() {
    this.load.image("kitchen_bg", "assets/bg/kitchen_bg.png");
    this.load.audio("oven", "assets/sounds/oven.mp3");
    this.load.spritesheet("bowls-sprite", "assets/ingredients/bowls-sprite.png", {
      frameWidth: 320,
      frameHeight: 230,
    });
    this.load.image("dough_base", "assets/ingredients/dough.png");
    this.load.image("dough_baked", "assets/ingredients/dough-baked.png");
    this.load.image("sauce_cursor", "assets/ingredients/sauce_cursor.png");
    this.load.spritesheet("cursors-sprite", "assets/ingredients/cursors-sprite.png", {
      frameWidth: 265,
      frameHeight: 110,
    });
    this.load.spritesheet("sprinkle-sprite", "assets/ingredients/sprinkle-sprite.png", {
      frameWidth: 190,
      frameHeight: 90,
    });
    this.load.image("cutter_tool", "assets/ingredients/cutter.png");
  }

  // Build the scene layout and UI.
  create() {
    const bg = this.add.image(0, 0, "kitchen_bg");
    this.bg = bg;
    const uiRoot = this.add.container(0, 0);
    applyCoverLayout(this, bg, uiRoot);
    this.ui = { root: uiRoot };
    AudioManager.init(this);
    this.isPizzaOnBench = true;
    this.isServeReady = false;
    this.resetPizzaState();

    // draw bowls
    const bowlY = 507;
    const bowlX = 110;
    const ingredients = GameState.enabledIngredients || [];
    const bowlFrames = ingredients.map((ingredient) => {
      const ingredientIndex = INGREDIENTS.indexOf(ingredient);
      if (ingredientIndex < 0) {
        return null;
      }
      const row = Math.floor(ingredientIndex / 4);
      const col = ingredientIndex % 4;
      return frameIndex(row, col);
    });
    const bowlSize = 160;
    const bowlheight = 120;
    const bowlIcons = {};

    ingredients.forEach((ingredient, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const frame = bowlFrames[index];
      if (frame === null || frame === undefined) {
        return;
      }
      const icon = this.add.image(
        bowlX + bowlSize * col,
        bowlY + bowlheight * row,
        "bowls-sprite",
        frame
      );
      icon.setScale(bowlSize / icon.width);
      uiRoot.add(icon);
      bowlIcons[ingredient] = icon;
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
    this.setupSprinkleInteractions(uiRoot, bowlIcons, ingredients);

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

    this.ui.serveButton = createButton(this, {
      width: 260,
      height: 90,
      label: "Serve it",
      textVariant: "label",
      onClick: () => {
        if (this.returnedPizzaReady) {
          this.captureBeltPizzaSnapshot(this.returnedPizza, this.rawDough);
        }
        this.scene.start("CounterScene", { hideConfirm: true });
      },
    });
    this.ui.serveButton.setVisible(false);
    this.ui.serveButton.setActive(false);
    this.ui.serveButton.setEnabled(false);
    uiRoot.add(this.ui.serveButton);

    const layoutButtons = () => {
      const target = screenToUi(uiRoot, this.scale.width * 0.5, this.scale.height * 0.92);
      this.ui.ovenButton.setPosition(target.x, target.y);
      this.ui.serveButton.setPosition(target.x, target.y);
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

    this.ui.scoreLabel = createCornerLabel(this, "", "score", 0);
    this.updateUI();
  }

  // Per-frame update hook.
  update() {
    // Game loop updates will go here.
  }
  //#endregion

  //#region UI
  // Update buttons and labels based on state.
  updateUI() {
    if (this.ui && this.ui.ovenButton) {
      this.ui.ovenButton.setEnabled(this.isPizzaOnBench);
    }
    if (this.ui && this.ui.serveButton) {
      this.ui.serveButton.setVisible(this.isServeReady);
      this.ui.serveButton.setActive(this.isServeReady);
      this.ui.serveButton.setEnabled(this.isServeReady);
    }
    if (this.ui && this.ui.scoreLabel) {
      const score = (GameState.madePizza && GameState.madePizza.score) || 0;
      this.ui.scoreLabel.setText(`Pizzas: ${GameState.pizzasMade}\nScore: ${score}`);
      this.ui.scoreLabel.setVisible(true);
    }
  }
  //#endregion

  //#region Sauce and sprinkle painting
  // Generic sprinkle setup for ingredients
  setupSprinkleInteractions(uiRoot, bowlIcons, ingredients) {
    this.sprinkleActive = false;
    this.sprinklePainting = false;
    this.sprinkleIconRef = null;
    this.sprinkleConfig = null;
    this.lastSprinkleStampTime = 0;
    this.sprinkleCursor = this.createSprinkleCursor(uiRoot, "sauce_cursor", null, 60);

    this.sprinkleConfigs = ingredients
      .map((ingredient, index) => {
        const icon = bowlIcons[ingredient];
        if (!icon) {
          return null;
        }
        const ingredientIndex = INGREDIENTS.indexOf(ingredient);
        if (ingredientIndex < 0) {
          return null;
        }
        const isPrimary = index === 0;
        const cursorKey = isPrimary ? "sauce_cursor" : "cursors-sprite";
        const cursorRow = Math.floor(ingredientIndex / 3);
        const cursorCol = ingredientIndex % 3;
        const cursorFrame = isPrimary ? null : frameIndex(cursorRow, cursorCol, 3)-1;
        const cursorWidth = isPrimary ? 140 : 120;
        const sprinkleWidth = isPrimary ? 90 : 80;
        return {
          icon,
          ingredient,
          cursorKey,
          cursorFrame,
          cursorWidth,
          sprinkleFrames: [
            frameIndex(ingredientIndex, 0),
            frameIndex(ingredientIndex, 1),
            frameIndex(ingredientIndex, 2),
            frameIndex(ingredientIndex, 3),
          ],
          sprinkleWidth,
        };
      })
      .filter(Boolean);

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
    if (typeof config.cursorFrame === "number") {
      this.sprinkleCursor.setFrame(config.cursorFrame);
    }
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

  // Custom cursor for sprinkle ingredients.
  createSprinkleCursor(uiRoot, textureKey, frame, targetWidth) {
    const bunch = this.add.image(0, 0, textureKey, frame);
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

  // Get the current sprinkle tip position.
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

//#endregion

  //#region Scoring
  // Reset per-pizza state while preserving running score.
  resetPizzaState() {
    const runningScore = (GameState.madePizza && GameState.madePizza.score) || 0;
    GameState.madePizza = {
      ingredients: new Set(),
      baked: false,
      cut: false,
      boxed: false,
      score: runningScore,
      snapshotKey: null,
      snapshotSize: null,
    };
  }

  // Track a topping added to the pizza.
  registerIngredient(name) {
    if (!name || !GameState.madePizza) {
      return;
    }
    GameState.madePizza.ingredients.add(name);
  }

  // Calculate the earned score for the current pizza.
  calculatePizzaScore() {
    const order = (GameState.currentOrder && GameState.currentOrder.ingredients) || [];
    const orderSet = new Set(order);
    const added = GameState.madePizza.ingredients;
    let correct = 0;

    added.forEach((ingredient) => {
      if (orderSet.has(ingredient)) {
        correct += 1;
      }
    });

    const rawScore = correct * 10;
    GameState.madePizza.score = Math.max(0, rawScore);
  }
  //#endregion

  //#region Pizza cutter
  // Create the cutter tool prop.
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

  // Create the cutter cursor that follows the pointer.
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

  // Wire up cutter input handlers.
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

  // Pick up the cutter tool and switch to cursor mode.
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

  // Show the cutter tool when ready.
  showCutterTool() {
    if (!this.cutterTool || this.cutterPickedUp) {
      return;
    }
    this.cutterTool.setVisible(true);
    this.cutterTool.setActive(true);
    this.cutterTool.setInteractive({ useHandCursor: true });
    this.ui.root.bringToTop(this.cutterTool);
  }

  // Create slice guide overlays.
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

  // Position guides based on the returned pizza location.
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

  // Show a single guide based on selection.
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

  // Hide non-used guides.
  hideCutGuides() {
    this.cutGuides.forEach((entry) => {
      if (!entry.used) {
        entry.guide.setVisible(false);
      }
    });
  }

  // Pick the closest cut guide based on cursor angle.
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

  // Hit test the returned pizza ellipse.
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

  // Draw a dashed line for a guide.
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

  // Draw a solid line for a guide.
  drawSolidLine(graphics, length) {
    graphics.strokeLineShape(new Phaser.Geom.Line(-length / 2, 0, length / 2, 0));
  }

  // Compute the visible guide length based on pizza ellipse.
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

  // Mark a guide as used after cutting.
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

    const usedCount = this.cutGuides.filter((guideEntry) => guideEntry.used).length;
    if (usedCount >= 3) {
      this.finishCutting();
    }
  }

  // Return the cutter to its resting state after all cuts.
  finishCutting() {
    this.cutterPickedUp = false;
    this.input.setDefaultCursor("default");
    if (this.cutterCursor) {
      this.cutterCursor.setVisible(false);
    }
    if (this.cutterTool) {
      this.cutterTool.setVisible(true);
      this.cutterTool.setActive(true);
      this.cutterTool.setInteractive({ useHandCursor: true });
      this.ui.root.bringToTop(this.cutterTool);
    }
  }

  // Animate the cutter across a guide line.
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

  //#region Input helpers
  // Handle cursor visibility when hovering UI elements.
  attachHoverCursorReset(target) {
    target.on("pointerover", () => {
      if (!this.sprinkleActive) {
        return;
      }
      this.input.setDefaultCursor("default");
      if (this.sprinkleCursor) {
        this.sprinkleCursor.setVisible(false);
      }
    });

    target.on("pointerout", () => {
      if (this.sprinkleActive) {
        this.input.setDefaultCursor("none");
        if (this.sprinkleCursor) {
          this.sprinkleCursor.setVisible(true);
        }
      }
    });
  }
  //#endregion

  //#region Oven animation
  // Capture a snapshot of the pizza on the conveyor belt.
  captureBeltPizzaSnapshot(beltPizza, rawDough) {
    if (!beltPizza || !GameState.madePizza) {
      return;
    }
    const snapshotKey = "baked_pizza_snapshot";

    const previousAlpha = rawDough ? rawDough.alpha : 1;
    if (rawDough) {
      rawDough.setAlpha(0);
    }

    const hiddenItems = [];
    if (this.bg) {
      hiddenItems.push({ target: this.bg, visible: this.bg.visible, alpha: this.bg.alpha });
      this.bg.setVisible(false);
    }
    if (this.ui && this.ui.root) {
      this.ui.root.list.forEach((child) => {
        if (child === beltPizza) {
          return;
        }
        hiddenItems.push({ target: child, visible: child.visible, alpha: child.alpha });
        child.setVisible(false);
      });
    }

    const bounds = beltPizza.getBounds();
    const width = Math.ceil(bounds.width);
    const height = Math.ceil(bounds.height);
    if (!width || !height) {
      console.warn("Snapshot skipped: empty bounds", bounds);
      if (rawDough) {
        rawDough.setAlpha(previousAlpha);
      }
      hiddenItems.forEach(({ target, visible, alpha }) => {
        target.setVisible(visible);
        target.setAlpha(alpha);
      });
      return;
    }

    const camera = this.cameras.main;
    const zoom = camera.zoom || 1;
    const captureX = (bounds.x - camera.scrollX) * zoom;
    const captureY = (bounds.y - camera.scrollY) * zoom;
    const captureW = Math.ceil(width * zoom);
    const captureH = Math.ceil(height * zoom);

    this.time.delayedCall(0, () => {
      this.game.renderer.snapshotArea(captureX, captureY, captureW, captureH, (image) => {
        if (this.textures.exists(snapshotKey)) {
          this.textures.remove(snapshotKey);
        }

        const canvasTexture = this.textures.createCanvas(snapshotKey, captureW, captureH);
        const ctx = canvasTexture.context;
        ctx.clearRect(0, 0, captureW, captureH);
        ctx.drawImage(image, 0, 0, captureW, captureH);
        const img = ctx.getImageData(0, 0, captureW, captureH);
        const data = img.data;
        const bg = { r: 0x1c, g: 0x1c, b: 0x1c };
        const threshold = 3;

        for (let i = 0; i < data.length; i += 4) {
          const dr = Math.abs(data[i] - bg.r);
          const dg = Math.abs(data[i + 1] - bg.g);
          const db = Math.abs(data[i + 2] - bg.b);
          if (dr <= threshold && dg <= threshold && db <= threshold) {
            data[i + 3] = 0;
          }
        }

        ctx.putImageData(img, 0, 0);
        canvasTexture.refresh();

        GameState.madePizza.snapshotKey = snapshotKey;
        GameState.madePizza.snapshotSize = { width: captureW, height: captureH };
        if (rawDough) {
          rawDough.setAlpha(previousAlpha);
        }
        hiddenItems.forEach(({ target, visible, alpha }) => {
          target.setVisible(visible);
          target.setAlpha(alpha);
        });
      });
    });
  }

  // Capture pizza snapshot and animate on conveyor belt.
  sendPizzaToOven() {
    if (!this.isPizzaOnBench) {
      return;
    }
    this.isPizzaOnBench = false;
    this.isServeReady = false;
    this.deactivateSprinkle();
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
    this.beltToppingsSnapshot = toppingsSnapshot;
    this.dough.setVisible(wasDoughVisible);

    const doughOffsetX = this.dough.x - localX;
    const doughOffsetY = this.dough.y - localY;
    const benchX = localX;
    const benchY = localY;
    const doughWidth = this.dough.displayWidth;
    const doughHeight = this.dough.displayHeight;

    const rawDough = this.add.image(doughOffsetX, doughOffsetY, "dough_base");
    rawDough.setDisplaySize(doughWidth, doughHeight);
    this.rawDough = rawDough;

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
    AudioManager.playSfx("oven", { duration: (travelDelay + travelDuration) / 1000 });
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
                  // completed oven amination
                  this.returnedPizzaReady = true;
                  this.updateCutGuideLayout();
                  this.showCutterTool();
                  this.isServeReady = true;
                  this.updateUI();
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
      onComplete: () => {
        this.captureBeltPizzaSnapshot(beltPizza, rawDough);
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
