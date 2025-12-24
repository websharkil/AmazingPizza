// #region Config and Globals
const GAME_WIDTH = 1024;
const GAME_HEIGHT = 768;

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
  }

  create() {
    const bg = this.add.image(0, 0, "kitchen_bg");
    const ui = this.add.container(0, 0);
    applyCoverLayout(this, bg, ui);
    this.ui = ui;

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
    });

    const dough = this.add.image(878, 658, "dough_base");
    const doughSize = 464;
    dough.setScale(doughSize / dough.width);
    ui.add(dough);

    this.doughBounds = this.getSauceBounds(dough);
    this.setupSauceInteraction(ui, dough, ingredientIcons["ingredient_sauce"]);
    this.setupSprinkleInteractions(ui, ingredientIcons);
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

    this.sauceLayers = this.createSauceLayers(ui, dough);
    this.sauceLayerIndex = 0;
    this.sauceStamp = this.make.graphics({ x: 0, y: 0, add: false });
    this.ladleCursor = this.createLadleCursor(ui);

    sauceIcon.setInteractive({ useHandCursor: true });
    sauceIcon.on("pointerdown", (pointer) => {
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
      if (!this.sauceActive) {
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
      if (!this.sauceActive) {
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
        if (this.sprinkleActive && this.sprinkleIconRef === config.icon) {
          this.deactivateSprinkle();
          return;
        }

        this.deactivateSauce();
        this.activateSprinkle(config, pointer);
      });
    });

    this.input.on("pointerdown", (pointer) => {
      if (!this.sprinkleActive) {
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
      if (!this.sprinkleActive) {
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
  createSauceLayers(ui, dough) {
    const size = Math.max(dough.displayWidth, dough.displayHeight);
    const alphas = [0.4, 0.6, 0.8];
    const layers = [];

    alphas.forEach((alpha) => {
      const layer = this.add.renderTexture(dough.x, dough.y, size, size);
      layer.setOrigin(0.5, 0.5);
      layer.setAlpha(alpha);
      ui.add(layer);
      layers.push(layer);
    });

    return layers;
  }

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
    const baseCenter = { x: 516, y: 467.5 };
    const baseRadii = { rx: 329, ry: 188.5 };
    const scaleX = dough.displayWidth / dough.width;
    const scaleY = dough.displayHeight / dough.height;
    const offsetX = (baseCenter.x - dough.width * 0.5) * scaleX;
    const offsetY = (baseCenter.y - dough.height * 0.5) * scaleY;

    return {
      cx: dough.x + offsetX,
      cy: dough.y + offsetY,
      rx: baseRadii.rx * scaleX,
      ry: baseRadii.ry * scaleY,
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
    this.ui.bringToTop(layer);
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
    this.ui.add(sprinkle);
    this.ui.bringToTop(sprinkle);
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
  scene: [CounterScene, KitchenScene],
};

new Phaser.Game(config);

// #endregion
