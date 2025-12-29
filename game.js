// #region Config and Globals
const GAME_WIDTH = 1024;
const GAME_HEIGHT = 768;
const DEBUG_START_BAKED_CUT = true; // Set to false to use the normal flow.

const INGREDIENTS = [
  "olives",
  "sauce",
  "cheese",
  "mushrooms",
  "peppers",
  "spinach",
  "sausage",
  "onions",
  "pepperoni",
  "pineapple",
];

const GameState = {
  currentCustomer: null,
  currentOrder: null,
  madePizza: { ingredients: new Set(), baked: false, cut: false, boxed: false },
};

// #endregion

// #region Shared Helpers
// Keep UI aligned with the cropped background when the canvas resizes.
function applyCoverLayout(scene, bgImage, uiContainer) {
  const resize = (width, height) => {
    const scale = Math.max(width / bgImage.width, height / bgImage.height);
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

// #endregion

// #region Counter Scene
class CounterScene extends Phaser.Scene {
  constructor() {
    super({ key: "CounterScene" });
  }

  preload() {
    this.load.image("counter_bg", "assets/bg/counter_bg.png");
    this.load.image("customer1", "assets/customers/character1.png");
    this.load.image("customer2", "assets/customers/character2.png");
    this.load.image("customer3", "assets/customers/character3.png");
    this.load.image("customer4", "assets/customers/character4.png");
    this.load.image("customer5", "assets/customers/character5.png");
  }

  create() {
    const bg = this.add.image(0, 0, "counter_bg");
    const ui = this.add.container(0, 0);
    applyCoverLayout(this, bg, ui);

    const customerKey = `customer${Phaser.Math.Between(1, 5)}`;
    const customer = this.add.image(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.52, customerKey);
    const targetHeight = GAME_HEIGHT * 0.45;
    customer.setScale(targetHeight / customer.height);
    const counterY = 720;
    customer.y = counterY - customer.displayHeight * 0.5;
    ui.add(customer);

    const order = this.getRandomOrder();
    ui.add(this.createSpeechBubble(customer, order));

    ui.add(this.createConfirmButton(() => {
      GameState.currentCustomer = { id: Date.now(), type: customerKey, spriteKey: customerKey };
      GameState.currentOrder = { ingredients: order };
      this.scene.start("KitchenScene");
    }));
  }

  update() {
    // Game loop updates will go here.
  }

  // Random order of 1-4 ingredients.
  getRandomOrder() {
    const count = Phaser.Math.Between(1, 4);
    const pool = Phaser.Utils.Array.Shuffle([...INGREDIENTS]);
    return pool.slice(0, count);
  }

  // Draw a speech bubble with ingredient icons.
  createSpeechBubble(customer, ingredients) {
    const bubbleWidth = Math.max(160, ingredients.length * 80);
    const bubbleHeight = 110;
    const x = customer.x + customer.displayWidth * 0.2;
    const y = customer.y - customer.displayHeight * 0.5 - bubbleHeight * 0.6;
    const bubbleContainer = this.add.container(0, 0);
    const bubble = this.add.graphics();

    bubble.lineStyle(4, 0x6b4c2a, 1);
    bubble.fillStyle(0xffffff, 0.95);
    bubble.fillRoundedRect(x - bubbleWidth / 2, y - bubbleHeight / 2, bubbleWidth, bubbleHeight, 24);
    bubble.fillTriangle(
      x - bubbleWidth * 0.15,
      y + bubbleHeight / 2,
      x - bubbleWidth * 0.02,
      y + bubbleHeight / 2,
      x - bubbleWidth * 0.08,
      y + bubbleHeight / 2 + 22
    );

    bubbleContainer.add(bubble);

    const iconSpacing = 70;
    const startX = x - ((ingredients.length - 1) * iconSpacing) / 2;
    const iconY = y + 5;

    ingredients.forEach((ingredient, index) => {
      const iconX = startX + index * iconSpacing;
      const color = this.getIngredientColor(ingredient);
      const circle = this.add.circle(iconX, iconY, 20, color, 1).setStrokeStyle(3, 0xffffff, 1);
      const label = this.add
        .text(iconX, iconY + 1, ingredient.slice(0, 3).toUpperCase(), {
          fontFamily: "Arial, sans-serif",
          fontSize: "12px",
          color: "#2f2517",
          align: "center",
        })
        .setOrigin(0.5, 0.5);
      bubbleContainer.add(circle);
      bubbleContainer.add(label);
    });

    return bubbleContainer;
  }

  getIngredientColor(ingredient) {
    const colors = {
      olives: 0x3b2f2f,
      sauce: 0xd1462f,
      cheese: 0xf7d26a,
      mushrooms: 0xc4b6a6,
      peppers: 0x7cc36a,
      spinach: 0x3f8d4f,
      sausage: 0xc27b5b,
      onions: 0xe6d6f0,
      pepperoni: 0xd24a4a,
      pineapple: 0xf6c84c,
    };
    return colors[ingredient] || 0xcccccc;
  }

  // Confirm button to enter the kitchen.
  createConfirmButton(onConfirm) {
    const buttonWidth = 260;
    const buttonHeight = 90;
    const button = this.add.graphics();
    const x = GAME_WIDTH/2+buttonWidth;
    const y = 870;
    button.fillStyle(0xffd76a, 1);
    button.lineStyle(4, 0x5b3a1c, 1);
    button.fillRoundedRect(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight, 18);
    button.strokeRoundedRect(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight, 18);

    const label = this.add
      .text(x, y, "OK!", {
        fontFamily: "Arial, sans-serif",
        fontSize: "28px",
        color: "#5b3a1c",
      })
      .setOrigin(0.5, 0.5);

    const hitArea = new Phaser.Geom.Rectangle(
      x - buttonWidth / 2,
      y - buttonHeight / 2,
      buttonWidth,
      buttonHeight
    );

    button.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains).on("pointerdown", () => {
      onConfirm();
    });

    return this.add.container(0, 0, [button, label]);
  }
}

// #endregion

// #region Kitchen Scene
class KitchenScene extends Phaser.Scene {
  constructor() {
    super({ key: "KitchenScene" });
  }

  preload() {
    this.load.image("kitchen_bg", "assets/bg/kitchen_bg.png");
    this.load.image("ingredient_cheese", "assets/ingredients/cheese.png");
    this.load.image("ingredient_sauce", "assets/ingredients/sauce.png");
    this.load.image("ingredient_olives", "assets/ingredients/olives.png");
    this.load.image("dough_base", "assets/ingredients/dough.png");
    this.load.image("dough_baked", "assets/ingredients/dough-baked.png");
    this.load.image("ladle_cursor", "assets/ingredients/sauce_cursor.png");
    this.load.image("cheese_cursor", "assets/ingredients/cheese_cursor.png");
    this.load.image("cheese_sprinkle_1", "assets/ingredients/cheese1.png");
    this.load.image("cheese_sprinkle_2", "assets/ingredients/cheese2.png");
    this.load.image("cheese_sprinkle_3", "assets/ingredients/cheese3.png");
    this.load.image("cheese_sprinkle_4", "assets/ingredients/cheese4.png");
    this.load.image("olives_cursor", "assets/ingredients/olives_cursor.png");
    this.load.image("olives_sprinkle_1", "assets/ingredients/olives1.png");
    this.load.image("olives_sprinkle_2", "assets/ingredients/olives2.png");
    this.load.image("olives_sprinkle_3", "assets/ingredients/olives3.png");
    this.load.image("olives_sprinkle_4", "assets/ingredients/olives4.png");
    this.load.image("cutter_tool", "assets/ingredients/cutter.png");
  }

  create() {
    const bg = this.add.image(0, 0, "kitchen_bg");
    const ui = this.add.container(0, 0);
    applyCoverLayout(this, bg, ui);
    this.ui = ui;
    this.isPizzaOnBench = true;

    const ingredientY = 507;
    const ingredientX = [110, 260, 420];
    const ingredientKeys = ["ingredient_sauce", "ingredient_cheese", "ingredient_olives"];
    const ingredientSize = 140;
    const ingredientIcons = {};

    ingredientKeys.forEach((key, index) => {
      const icon = this.add.image(ingredientX[index], ingredientY, key);
      icon.setScale(ingredientSize / icon.width);
      ui.add(icon);
      ingredientIcons[key] = icon;
      this.attachHoverCursorReset(icon);
    });

    this.pizzaContainer = this.add.container(0, 0);
    ui.add(this.pizzaContainer);

    const dough = this.add.image(878, 658, "dough_base");
    const doughSize = 464;
    dough.setScale(doughSize / dough.width);
    this.pizzaContainer.add(dough);
    this.dough = dough;

    this.doughBounds = this.getSauceBounds(dough);
    this.setupSauceInteraction(ui, dough, ingredientIcons["ingredient_sauce"]);
    this.setupSprinkleInteractions(ui, ingredientIcons);

    this.scale.on("resize", () => {
      this.doughBounds = this.getSauceBounds(this.dough);
    });

    this.ovenButton = this.createOvenButton();
    ui.add(this.ovenButton);

    this.cutterPickedUp = false;
    this.returnedPizzaReady = false;
    this.cutterTool = this.createCutterTool();
    this.cutterCursor = this.createCutterCursor();
    this.cutGuides = this.createCutGuides();
    this.setupCutterInput();
    this.cutterAnimating = false;

    if (DEBUG_START_BAKED_CUT) {
      this.startDebugBakedPizza();
    }
  }


  update() {
    // Game loop updates will go here.
  }

  // Sauce painting input and cursor management.
  setupSauceInteraction(ui, dough, sauceIcon) {
    this.sauceActive = false;
    this.saucePainting = false;
    this.sauceBlobSize = 36;
    this.sauceIconRef = sauceIcon;

    this.sauceLayers = this.createSauceLayers(dough);
    this.sauceLayerIndex = 0;
    this.sauceStamp = this.make.graphics({ x: 0, y: 0, add: false });
    this.ladleCursor = this.createLadleCursor(ui);

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
      const local = this.toUiLocal(ui, pointer);
      this.ladleCursor.setPosition(local.x, local.y);
      this.ui.bringToTop(this.ladleCursor);
    });

    this.input.on("pointerdown", (pointer) => {
      if (!this.sauceActive || !this.isPizzaOnBench) {
        return;
      }
      const local = this.toUiLocal(ui, pointer);
      this.ladleCursor.setPosition(local.x, local.y);
      this.ui.bringToTop(this.ladleCursor);
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
      const local = this.toUiLocal(ui, pointer);
      this.ladleCursor.setPosition(local.x, local.y);
      this.ui.bringToTop(this.ladleCursor);
      const tip = this.getLadleTip();
      if (this.saucePainting && pointer.isDown && this.isOnDough(tip.x, tip.y)) {
        this.stampSauce(tip.x, tip.y, dough);
      }
    });

    this.input.on("pointerup", () => {
      this.saucePainting = false;
    });
  }

  // Generic sprinkle setup for cheese/olives.
  setupSprinkleInteractions(ui, ingredientIcons) {
    this.sprinkleActive = false;
    this.sprinklePainting = false;
    this.sprinkleIconRef = null;
    this.sprinkleConfig = null;
    this.lastSprinkleStampTime = 0;
    this.sprinkleCursor = this.createSprinkleCursor(ui, "cheese_cursor", 60);

    this.sprinkleConfigs = [
      {
        icon: ingredientIcons["ingredient_cheese"],
        cursorKey: "cheese_cursor",
        cursorWidth: 100,
        sprinkleKeys: [
          "cheese_sprinkle_1",
          "cheese_sprinkle_2",
          "cheese_sprinkle_3",
          "cheese_sprinkle_4",
        ],
        sprinkleWidth: 68,
      },
      {
        icon: ingredientIcons["ingredient_olives"],
        cursorKey: "olives_cursor",
        cursorWidth: 100,
        sprinkleKeys: [
          "olives_sprinkle_1",
          "olives_sprinkle_2",
          "olives_sprinkle_3",
          "olives_sprinkle_4",
        ],
        sprinkleWidth: 70,
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
      const local = this.toUiLocal(ui, pointer);
      this.sprinkleCursor.setPosition(local.x, local.y);
      this.ui.bringToTop(this.sprinkleCursor);
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
      const local = this.toUiLocal(ui, pointer);
      this.sprinkleCursor.setPosition(local.x, local.y);
      this.ui.bringToTop(this.sprinkleCursor);
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

  // Activate a selected sprinkle bowl (cheese/olives).
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
    const local = this.toUiLocal(this.ui, pointer);
    this.sprinkleCursor.setPosition(local.x, local.y);
    this.ui.bringToTop(this.sprinkleCursor);
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
  createLadleCursor(ui) {
    const ladle = this.add.image(0, 0, "ladle_cursor");
    ladle.setOrigin(0, 1);
    ladle.setScale(0.8);
    ladle.setVisible(false);
    ladle.setDepth(1000);
    ui.add(ladle);
    return ladle;
  }

  // Custom cursor for sprinkle ingredients.
  createSprinkleCursor(ui, textureKey, targetWidth) {
    const bunch = this.add.image(0, 0, textureKey);
    bunch.setOrigin(0, 1);
    bunch.setScale(targetWidth / bunch.width);
    bunch.setVisible(false);
    bunch.setDepth(1000);
    ui.add(bunch);
    return bunch;
  }

  // Convert pointer coordinates into UI container space.
  toUiLocal(ui, pointer) {
    const x = (pointer.worldX - ui.x) / ui.scaleX;
    const y = (pointer.worldY - ui.y) / ui.scaleY;
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
      cy: dough.y + (centerYRatio - 0.5) * dough.displayHeight-20,
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
  }

  // Drop a random sprinkle image at the cursor tip.
  stampSprinkle(x, y) {
    const now = this.time.now;
    if (now - this.lastSprinkleStampTime < 40) {
      return;
    }
    this.lastSprinkleStampTime = now;

    const key = Phaser.Utils.Array.GetRandom(this.sprinkleConfig.sprinkleKeys);
    const sprinkle = this.add.image(x, y, key);
    sprinkle.setScale(this.sprinkleConfig.sprinkleWidth / sprinkle.width);
    sprinkle.setRotation(Phaser.Math.FloatBetween(-0.4, 0.4));
    this.pizzaContainer.add(sprinkle);
    this.pizzaContainer.bringToTop(sprinkle);
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

  createOvenButton() {
    const buttonWidth = 260;
    const buttonHeight = 90;
    const x = 735;
    const y = 860;
    const button = this.add.graphics();
    button.fillStyle(0xffb347, 1);
    button.lineStyle(4, 0x5b3a1c, 1);
    button.fillRoundedRect(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight, 18);
    button.strokeRoundedRect(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight, 18);

    const label = this.add
      .text(x, y, "To the oven", {
        fontFamily: "Arial, sans-serif",
        fontSize: "22px",
        color: "#5b3a1c",
      })
      .setOrigin(0.5, 0.5);

    const hitArea = new Phaser.Geom.Rectangle(
      x - buttonWidth / 2,
      y - buttonHeight / 2,
      buttonWidth,
      buttonHeight
    );

    button.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains).on("pointerdown", () => {
      this.sendPizzaToOven();
    });
    this.attachHoverCursorReset(button);

    return this.add.container(0, 0, [button, label]);
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
    this.ui.add(tool);
    return tool;
  }

  createCutterCursor() {
    const targetWidth = 140;
    const cursor = this.add.image(0, 0, "cutter_tool");
    cursor.setOrigin(0.1, 0.5);
    cursor.setScale(targetWidth / cursor.width);
    cursor.setVisible(false);
    cursor.setDepth(1200);
    this.ui.add(cursor);
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
      const local = this.toUiLocal(this.ui, pointer);
      this.cutterCursor.setPosition(local.x, local.y);
      this.ui.bringToTop(this.cutterCursor);

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
      const local = this.toUiLocal(this.ui, pointer);
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
    const local = this.toUiLocal(this.ui, pointer);
    this.cutterCursor.setPosition(local.x, local.y);
    this.ui.bringToTop(this.cutterCursor);
  }

  showCutterTool() {
    if (!this.cutterTool || this.cutterPickedUp) {
      return;
    }
    this.cutterTool.setVisible(true);
    this.cutterTool.setActive(true);
    this.cutterTool.setInteractive({ useHandCursor: true });
    this.ui.bringToTop(this.cutterTool);
  }

  createCutGuides() {
    const angles = [Math.PI / 2, Math.PI / 6, -Math.PI / 6];
    return angles.map((angle) => {
      const guide = this.add.graphics();
      guide.setVisible(false);
      guide.setDepth(900);
      this.ui.add(guide);
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
        this.ui.bringToTop(entry.guide);
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
    this.ui.bringToTop(entry.guide);
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
    this.ui.bringToTop(this.cutterCursor);

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
        const local = this.toUiLocal(this.ui, pointer);
        this.cutterCursor.setPosition(local.x, local.y);
        this.cutterCursor.setVisible(true);
        this.cutterAnimating = false;
        this.markGuideUsed(index);
      },
    });
  }


  startDebugBakedPizza() {
    this.isPizzaOnBench = false;
    this.deactivateSauce();
    this.deactivateSprinkle();

    const bounds = this.pizzaContainer.getBounds();
    const localX = (bounds.x - this.ui.x) / this.ui.scaleX;
    const localY = (bounds.y - this.ui.y) / this.ui.scaleY;
    const width = Math.ceil(bounds.width / this.ui.scaleX);
    const height = Math.ceil(bounds.height / this.ui.scaleY);
    const wasDoughVisible = this.dough.visible;
    this.dough.setVisible(false);
    const toppingsSnapshot = this.add.renderTexture(0, 0, width, height);
    toppingsSnapshot.draw(this.pizzaContainer, -localX, -localY);
    toppingsSnapshot.setOrigin(0, 0);
    toppingsSnapshot.setPosition(0, 0);
    this.dough.setVisible(wasDoughVisible);
    toppingsSnapshot.setTint(Phaser.Display.Color.GetColor(140, 120, 100));

    const doughOffsetX = this.dough.x - localX;
    const doughOffsetY = this.dough.y - localY;
    const doughWidth = this.dough.displayWidth;
    const doughHeight = this.dough.displayHeight;

    const bakedDough = this.add.image(doughOffsetX, doughOffsetY, "dough_baked");
    bakedDough.setDisplaySize(doughWidth, doughHeight);

    const bakedPizza = this.add.container(localX, localY);
    bakedPizza.add([bakedDough, toppingsSnapshot]);
    this.ui.add(bakedPizza);

    this.returnedPizza = bakedPizza;
    this.returnedDough = bakedDough;
    this.returnedPizzaReady = true;
    this.updateCutGuideLayout();
    this.showCutterTool();

    this.pizzaContainer.setVisible(false);
    this.pizzaContainer.setActive(false);
    if (this.ovenButton) {
      this.ovenButton.setVisible(false);
      this.ovenButton.setActive(false);
    }
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

  // Capture pizza snapshot and animate on conveyor belt.
  sendPizzaToOven() {
    if (!this.isPizzaOnBench) {
      return;
    }
    this.isPizzaOnBench = false;
    this.deactivateSauce();
    this.deactivateSprinkle();

    // create snapshot of pizza
    const bounds = this.pizzaContainer.getBounds();
    const localX = (bounds.x - this.ui.x) / this.ui.scaleX;
    const localY = (bounds.y - this.ui.y) / this.ui.scaleY;
    const width = Math.ceil(bounds.width / this.ui.scaleX);
    const height = Math.ceil(bounds.height / this.ui.scaleY);
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
    this.ui.add(beltPizza);
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
        const fadeHalf = 500;
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
      alpha: 0,
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
    if (this.ovenButton) {
      this.ovenButton.setVisible(false);
      this.ovenButton.setActive(false);
    }
  }
}

// #endregion

// #region Game Bootstrap
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
  //scene: [CounterScene, KitchenScene],
  scene: [KitchenScene],
};

new Phaser.Game(config);

// #endregion
