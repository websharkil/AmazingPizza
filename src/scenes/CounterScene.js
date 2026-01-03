import { GAME_HEIGHT, GAME_WIDTH, INGREDIENT_COLORS, INGREDIENTS, INGREDIENT_UNLOCK_POINTS } from "../constants.js";
import { GameState } from "../state.js";
import { AudioManager } from "../audio/AudioManager.js";
import { createButton } from "../ui/UIButton.js";
import { createBubble } from "../ui/UIBubble.js";
import { createCornerLabel } from "../ui/UILabel.js";
import { Theme } from "../ui/theme.js";
import { applyCoverLayout, screenToUi } from "../ui/layout.js";
import { createTurningWheel } from '../ui/wheel.js';

//#region Helpers
// Compute a spritesheet frame index.
function frameIndex(row, col, cols = 3) {
  return row * cols + col;
}

// Parse legacy customer sprite keys to a row index.
function parseLegacyCustomerRow(spriteKey) {
  if (!spriteKey) {
    return null;
  }
  const match = String(spriteKey).match(/customer(\d+)/i);
  if (!match) {
    return null;
  }
  const row = Number.parseInt(match[1], 10) - 1;
  if (Number.isNaN(row)) {
    return null;
  }
  return Phaser.Math.Clamp(row, 0, 5);
}

// Calculate the earned score for a single pizza.
function calculatePizzaScore(order, madePizza) {
  const orderSet = new Set(order || []);
  const added = (madePizza && madePizza.ingredients) || new Set();
  let correct = 0;

  added.forEach((ingredient) => {
    if (orderSet.has(ingredient)) {
      correct += 1;
    }
  });

  return Math.max(0, correct * 10);
}

// Check whether the order and pizza ingredients match exactly.
function isOrderCorrect(order, madePizza) {
  const orderSet = new Set(order || []);
  const added = (madePizza && madePizza.ingredients) || new Set();
  if (orderSet.size !== added.size) {
    return false;
  }
  for (const item of orderSet) {
    if (!added.has(item)) {
      return false;
    }
  }
  return true;
}

// Apply mood and score results for the served pizza.
function applyOrderResult(customer, customerRow, order, madePizza) {
  if (!customer) {
    return false;
  }
  const correct = isOrderCorrect(order, madePizza);
  const moodCol = correct ? 1 : 2;
  customer.setFrame(frameIndex(customerRow, moodCol));

  const earned = calculatePizzaScore(order, madePizza);
  const runningScore = (GameState.madePizza && GameState.madePizza.score) || 0;
  GameState.madePizza.score = runningScore + earned;
  GameState.pizzasMade += 1;
  return correct;
}

// Position the speech bubble relative to the customer.
function getBubblePosition(customer) {
  return {
    x: customer.x + customer.displayWidth * 0.2,
    y: customer.y - customer.displayHeight * 0.5 - 30,
  };
}
//#endregion

class CounterScene extends Phaser.Scene {
  // Create the scene instance.
  constructor() {
    super({ key: "CounterScene" });
  }

  // Initialize scene data from navigation.
  init(data) {
    this.hideConfirm = Boolean(data && data.hideConfirm);
  }

  // Load scene assets.
  preload() {
    this.load.image("counter_bg", "assets/bg/counter_bg.png");
    this.load.audio("swoosh", "assets/sounds/swoosh.mp3");
    this.load.audio("yay", "assets/sounds/yay.mp3");
    this.load.audio("harp", "assets/sounds/harp.mp3");
    this.load.spritesheet("bowls-sprite", "assets/ingredients/bowls-sprite.png", {
      frameWidth: 320,
      frameHeight: 230,
    });
    this.load.spritesheet("customers", "assets/customers/customers-sprite.png", {
      frameWidth: 280,
      frameHeight: 360,
    });
  }

  //#region Lifecycle
  // Build the scene layout and UI.
  create() {
    const bg = this.add.image(0, 0, "counter_bg");
    const uiRoot = this.add.container(0, 0);
    applyCoverLayout(this, bg, uiRoot);
    this.input.setDefaultCursor("default");
    AudioManager.init(this);
    const counterY = 720;
    const targetHeight = GAME_HEIGHT * 0.45;
    this.initUnlockWheel(uiRoot);

    const hasExistingOrder = Boolean(GameState.currentCustomer && GameState.currentOrder);
    const actionButton = this.createActionButton(uiRoot, hasExistingOrder);
    const scoreLabel = createCornerLabel(this, "", "score", 0);

    this.ui = { root: uiRoot, customer: null, bubble: null, confirmBtn: actionButton, scoreLabel, bakedPizza: null };
    this.updateUI();

    if (!hasExistingOrder) {
      this.setActionButton(actionButton, {
        label: "Next customer",
        onClick: () => this.startCustomerIntro(actionButton, uiRoot, counterY, targetHeight),
        enabled: true,
        visible: true,
      });
      return;
    }

    this.startExistingOrderFlow(actionButton, uiRoot, counterY, targetHeight);
  }

  // Per-frame update hook.
  update() {
    // Game loop updates will go here.
  }
  //#endregion

  //#region UI
  // Refresh UI labels and button states.
  updateUI() {
    if (this.ui && this.ui.bubble) {
      this.ui.bubble.setText(this.buildOrderParts(this.currentOrder));
    }
    if (this.ui && this.ui.confirmBtn) {
      this.ui.confirmBtn.setEnabled(true);
    }
    if (this.ui && this.ui.scoreLabel) {
      const score = (GameState.madePizza && GameState.madePizza.score) || 0;
      this.ui.scoreLabel.setText(`Pizzas: ${GameState.pizzasMade}\nScore: ${score}`);
    }
  }

  // Initialize the unlock wheel layout callbacks.
  initUnlockWheel(uiRoot) {
    this.unlockWheel = null;
    this.unlockWheelScaleFactor = 0.1;
    this.unlockWheelBaseScale = 1;
    this.layoutUnlockWheel = () => {
      if (!this.unlockWheel) {
        return;
      }
      this.unlockWheelBaseScale = uiRoot.scaleX;
      this.unlockWheel.setScale(this.unlockWheelBaseScale * this.unlockWheelScaleFactor);
      this.unlockWheel.setPosition(this.scale.width * 0.5, this.scale.height * 0.45);
    };
    this.scale.on("resize", this.layoutUnlockWheel);
  }

  // Create and lay out the shared action button.
  createActionButton(uiRoot, hasExistingOrder) {
    if (this.hideConfirm && !hasExistingOrder) {
      return null;
    }
    const actionButton = createButton(this, {
      width: 260,
      height: 90,
      label: "Next customer",
      textVariant: "label",
      onClick: () => {},
    });
    uiRoot.add(actionButton);

    const layoutButtons = () => {
      const target = screenToUi(uiRoot, this.scale.width * 0.5, this.scale.height * 0.92);
      actionButton.setPosition(target.x, target.y);
    };
    layoutButtons();
    this.scale.on("resize", layoutButtons);
    if (hasExistingOrder) {
      this.setActionButton(actionButton, { visible: false, enabled: false, active: false });
    }
    return actionButton;
  }

  // Create the order bubble near a customer.
  createOrderBubble(order, customer, uiRoot) {
    const bubble = createBubble(this, { textParts: this.buildOrderParts(order) });
    const bubblePos = getBubblePosition(customer);
    bubble.setPosition(bubblePos.x, bubblePos.y);
    uiRoot.add(bubble);
    return bubble;
  }

  // Position and show a bubble once the customer arrives.
  showOrderBubble(bubble, customer) {
    if (!bubble || !customer) {
      return;
    }
    const updatedPos = getBubblePosition(customer);
    bubble.setPosition(updatedPos.x, updatedPos.y);
    bubble.setVisible(true);
  }

  // Configure the shared action button.
  setActionButton(actionButton, options = {}) {
    if (!actionButton) {
      return;
    }
    const { label, onClick, visible, enabled, active } = options;
    if (typeof label === "string") {
      actionButton.setLabel(label);
    }
    if (onClick) {
      actionButton.onClick(onClick);
    }
    if (typeof visible === "boolean") {
      actionButton.setVisible(visible);
    }
    if (typeof active === "boolean") {
      actionButton.setActive(active);
    } else if (typeof visible === "boolean") {
      actionButton.setActive(visible);
    }
    if (typeof enabled === "boolean") {
      actionButton.setEnabled(enabled);
    }
  }

  // Show the unlock wheel for a newly enabled ingredient.
  showUnlockWheel(ingredient) {
    const ingredientIndex = INGREDIENTS.indexOf(ingredient);
    if (ingredientIndex < 0) {
      return;
    }
    const row = Math.floor(ingredientIndex / 4);
    const col = ingredientIndex % 4;
    const frame = frameIndex(row, col, 4);
    if (!this.unlockWheel) {
      this.unlockWheel = createTurningWheel(this, 0, 0, { centerFrame: frame });
    } else if (this.unlockWheel.centerSprite) {
      this.unlockWheel.centerSprite.setFrame(frame);
    }

    this.unlockWheelScaleFactor = 0.1;
    this.unlockWheel.container.setAlpha(0);
    this.layoutUnlockWheel();

    this.tweens.add({
      targets: { value: this.unlockWheelScaleFactor },
      value: 1,
      duration: 1000,
      ease: "Sine.easeOut",
      onUpdate: (tween) => {
        this.unlockWheelScaleFactor = tween.getValue();
        this.layoutUnlockWheel();
      },
    });
    this.tweens.add({
      targets: this.unlockWheel.container,
      alpha: 1,
      duration: 1000,
      ease: "Sine.easeOut",
    });
    this.time.delayedCall(3000, () => {
      this.tweens.add({
        targets: this.unlockWheel.container,
        alpha: 0,
        duration: 500,
        ease: "Sine.easeOut",
      });
    });
  }
  //#endregion

  //#region Customer animation
  // Create a customer sprite at the requested position.
  createCustomerSprite(row, y, targetHeight) {
    const customer = this.add.sprite(
      GAME_WIDTH * 0.5,
      GAME_HEIGHT * 0.52,
      "customers",
      frameIndex(row, 0)
    );
    customer.setScale(targetHeight / customer.height);
    customer.y = y;
    return customer;
  }

  // Spawn and animate a new customer with a fresh order.
  startCustomerIntro(actionButton, uiRoot, counterY, targetHeight) {
    if (!actionButton) {
      return;
    }
    this.setActionButton(actionButton, { enabled: false, active: false });

    this.customerRow = Phaser.Math.Between(0, 5);
    const entryY = counterY + targetHeight * 0.6;
    this.currentOrder = this.getRandomOrder();
    this.setupCustomer({
      row: this.customerRow,
      y: entryY,
      targetHeight,
      uiRoot,
      order: this.currentOrder,
      counterY,
    });

    const customerTargetY = counterY - this.customer.displayHeight * 0.5;
    this.animateCustomerIn(this.customer, customerTargetY, counterY, () => {
      this.showOrderBubble(this.ui.bubble, this.customer);
      this.setActionButton(actionButton, {
        label: "I'm on it!",
        onClick: () => {
          GameState.currentCustomer = {
            id: Date.now(),
            spriteKey: "customers",
            frameRow: this.customerRow,
            frameIndex: frameIndex(this.customerRow, 0),
          };
          GameState.currentOrder = { ingredients: this.currentOrder };
          this.scene.start("KitchenScene");
        },
        enabled: true,
        visible: true,
      });
      this.updateUI();
    });
  }

  // Build a customer sprite, order, and bubble in a shared flow.
  setupCustomer({ row, y, targetHeight, uiRoot, order, counterY }) {
    if (this.ui && this.ui.bubble) {
      this.ui.bubble.destroy();
    }
    this.customerRow = row;
    this.customer = this.createCustomerSprite(row, y, targetHeight);
    uiRoot.add(this.customer);
    this.applyCustomerCrop(this.customer, counterY);

    this.currentOrder = order;
    this.ui.bubble = this.createOrderBubble(order, this.customer, uiRoot);
    this.ui.bubble.setVisible(false);
    this.ui.customer = this.customer;
    this.ui.bakedPizza = null;
  }

  // Restore the returning customer and show the served pizza result.
  startExistingOrderFlow(actionButton, uiRoot, counterY, targetHeight) {
    const existingRow = GameState.currentCustomer.frameRow ?? parseLegacyCustomerRow(GameState.currentCustomer.spriteKey);
    const selectedRow = existingRow ?? Phaser.Math.Between(0, 5);
    const targetY = counterY - targetHeight * 0.5;
    this.currentOrder = GameState.currentOrder.ingredients;

    this.setupCustomer({
      row: selectedRow,
      y: targetY,
      targetHeight,
      uiRoot,
      order: this.currentOrder,
      counterY,
    });

    let resultBubble = null;
    let resultShown = false;
    // Show the result bubble and update state after serving.
    const showResult = () => {
      if (resultShown) {
        return;
      }
      resultShown = true;
      const correct = applyOrderResult(this.customer, this.customerRow, this.currentOrder, GameState.madePizza);
      const message = correct ? "YAY!" : "Oh no! I wanted ";
      if (correct) {
        AudioManager.playSfx("yay");
      }
      const unlockedIngredient = this.unlockIngredientsForScore(GameState.madePizza.score);
      if (unlockedIngredient) {
        this.time.delayedCall(2000, () => {
          AudioManager.playSfx("harp");
          this.showUnlockWheel(unlockedIngredient);
        });
      }
      if (resultBubble) {
        resultBubble.destroy();
      }
      const baseColor = Theme.text.bubble.color;
      const textParts = correct
        ? [{ text: message, color: baseColor }]
        : [{ text: message, color: baseColor }, ...this.buildIngredientParts(this.currentOrder)];
      resultBubble = createBubble(this, { textParts });
      const resultPos = getBubblePosition(this.customer);
      resultBubble.setPosition(resultPos.x, resultPos.y);
      uiRoot.add(resultBubble);
      this.setActionButton(actionButton, {
        label: "Next customer",
        onClick: () => {
          const score = (GameState.madePizza && GameState.madePizza.score) || 0;
          GameState.currentCustomer = null;
          GameState.currentOrder = null;
          GameState.madePizza = {
            ingredients: new Set(),
            baked: false,
            cut: false,
            boxed: false,
            score,
            snapshotKey: null,
            snapshotSize: null,
          };

          this.setActionButton(actionButton, { enabled: false, active: false });
          if (resultBubble) {
            resultBubble.setVisible(false);
          }
          if (this.ui.bubble) {
            this.ui.bubble.setVisible(false);
          }

          const exitY = counterY + this.customer.displayHeight * 0.6;
          this.animateCustomerOut(this.customer, exitY, counterY, () => {
            if (this.ui.bakedPizza) {
              this.ui.bakedPizza.destroy();
              this.ui.bakedPizza = null;
            }
            if (resultBubble) {
              resultBubble.destroy();
              resultBubble = null;
            }
            if (this.ui.bubble) {
              this.ui.bubble.destroy();
              this.ui.bubble = null;
            }
            if (this.customer) {
              this.customer.destroy();
            }

            this.time.delayedCall(1000, () => {
              resultShown = false;
              this.startCustomerIntro(actionButton, uiRoot, counterY, targetHeight);
            });
          });
        },
        visible: true,
        enabled: true,
      });
      this.updateUI();
    };

    const shouldScoreOrder = Boolean(GameState.currentOrder);
    if (GameState.madePizza && GameState.madePizza.snapshotKey) {
      const snapshotKey = GameState.madePizza.snapshotKey;
      if (this.textures.exists(snapshotKey)) {
        this.ui.bakedPizza = this.add.image(GAME_WIDTH * 0.75, 820, snapshotKey);
        this.ui.bakedPizza.setScale(1.55);
        uiRoot.add(this.ui.bakedPizza);
        const targetPizzaY = this.ui.bakedPizza.y;
        this.ui.bakedPizza.y = GAME_HEIGHT + this.ui.bakedPizza.displayHeight * 0.5;
        this.tweens.add({
          targets: this.ui.bakedPizza,
          y: targetPizzaY,
          duration: 1000,
          ease: "Sine.easeOut",
          onComplete: () => {
            if (shouldScoreOrder) {
              showResult();
            }
          },
        });
      }
    }
    if (shouldScoreOrder && !this.ui.bakedPizza) {
      showResult();
    }

    this.updateUI();
  }

  // Slide a customer sprite up into view.
  animateCustomerIn(customer, targetY, counterY, onComplete) {
    if (!customer) {
      return;
    }
    AudioManager.playSfx("swoosh", { seek: 0.2, duration: 1.2 });
    this.tweens.add({
      targets: customer,
      y: targetY,
      duration: 500,
      ease: "Sine.easeOut",
      onUpdate: () => {
        this.applyCustomerCrop(customer, counterY);
      },
      onComplete,
    });
  }

  // Slide a customer sprite down out of view.
  animateCustomerOut(customer, targetY, counterY, onComplete) {
    if (!customer) {
      return;
    }
    AudioManager.playSfx("swoosh", { seek: 1.3 });
    this.tweens.add({
      targets: customer,
      y: targetY,
      duration: 500,
      ease: "Sine.easeIn",
      onUpdate: () => {
        this.applyCustomerCrop(customer, counterY);
      },
      onComplete,
    });
  }

  // Crop the customer sprite so it hides below the counter line.
  applyCustomerCrop(customer, counterY) {
    if (!customer) {
      return;
    }
    const topY = customer.y - customer.displayHeight * customer.originY;
    const visibleHeight = Phaser.Math.Clamp(counterY - topY, 0, customer.displayHeight);
    if (visibleHeight >= customer.displayHeight) {
      customer.setCrop();
      return;
    }
    const cropHeight = visibleHeight / customer.scaleY;
    customer.setCrop(0, 0, customer.width, cropHeight);
  }
  //#endregion

  //#region Orders
  // Unlock new ingredients every 60 points and return the latest unlock.
  unlockIngredientsForScore(score) {
    const enabled = GameState.enabledIngredients || [];
    const targetCount = Math.min(
      INGREDIENTS.length,
      2 + Math.floor(score / INGREDIENT_UNLOCK_POINTS)
    );
    if (enabled.length >= targetCount) {
      GameState.enabledIngredients = enabled;
      return null;
    }
    const remaining = INGREDIENTS.filter((ingredient) => !enabled.includes(ingredient));
    let lastUnlocked = null;
    while (enabled.length < targetCount && remaining.length > 0) {
      const pick = Phaser.Utils.Array.GetRandom(remaining);
      enabled.push(pick);
      remaining.splice(remaining.indexOf(pick), 1);
      lastUnlocked = pick;
    }
    GameState.enabledIngredients = enabled;
    return lastUnlocked;
  }

  // Random order of 1-4 ingredients.
  getRandomOrder() {
    const count = Phaser.Math.Between(1, 4);
    const pool = Phaser.Utils.Array.Shuffle([...(GameState.enabledIngredients || [])]);
    return pool.slice(0, count);
  }

  //#region order text builders
  // Build the full order text parts.
  buildOrderParts(ingredients) {
    const parts = [];
    const baseColor = Theme.text.bubble.color;
    parts.push({ text: "Hi, I'd like a pizza with ", color: baseColor });
    parts.push(...this.buildIngredientParts(ingredients));
    return parts;
  }

  // Build ingredient-only text parts.
  buildIngredientParts(ingredients) {
    const parts = [];
    const baseColor = Theme.text.bubble.color;
    ingredients.forEach((ingredient, index) => {
      if (index > 0) {
        const separator = index === ingredients.length - 1 ? " and " : ", ";
        parts.push({ text: separator, color: baseColor });
      }
      const color = Phaser.Display.Color.IntegerToColor(this.getIngredientColor(ingredient)).rgba;
      parts.push({ text: ingredient, color });
    });
    return parts;
  }

  // Map ingredient names to display colors.
  getIngredientColor(ingredient) {
    return INGREDIENT_COLORS[ingredient] || 0xcccccc;
  }
  //#endregion
  //#endregion
}

export default CounterScene;
