import { ENABLED_INGREDIENTS, GAME_HEIGHT, GAME_WIDTH, INGREDIENT_COLORS } from "../constants.js";
import { GameState } from "../state.js";
import { AudioManager } from "../audio/AudioManager.js";
import { createButton } from "../ui/UIButton.js";
import { createBubble } from "../ui/UIBubble.js";
import { createCornerLabel } from "../ui/UILabel.js";
import { Theme } from "../ui/theme.js";
import { applyCoverLayout, screenToUi } from "../ui/layout.js";

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

    const hasExistingOrder = Boolean(GameState.currentCustomer && GameState.currentOrder);
    let actionButton = null;
    if (!this.hideConfirm || hasExistingOrder) {
      actionButton = createButton(this, {
        width: 260,
        height: 90,
        label: "Next customer",
        textVariant: "label",
        onClick: () => {},
      });
      uiRoot.add(actionButton);

      // Position the action button relative to the screen.
      const layoutButtons = () => {
        const target = screenToUi(uiRoot, this.scale.width * 0.5, this.scale.height * 0.92);
        actionButton.setPosition(target.x, target.y);
      };
      layoutButtons();
      this.scale.on("resize", layoutButtons);
      if (hasExistingOrder) {
        this.setActionButton(actionButton, { visible: false, enabled: false, active: false });
      }
    }
    let customerRow = null;
    let customer = null;
    let orderBubble = null;
    let bakedPizza = null;
    const scoreLabel = createCornerLabel(this, "", "score", 0);

    this.ui = { root: uiRoot, customer, bubble: orderBubble, confirmBtn: actionButton, scoreLabel, bakedPizza };
    this.updateUI();

    // Start the first customer flow on demand.
    const startFreshCustomer = () => {
      if (!actionButton) {
        return;
      }
      //AudioManager.playSfx("doorbell");
      this.setActionButton(actionButton, { enabled: false, active: false });

      customerRow = Phaser.Math.Between(0, 5);
      customer = this.add.sprite(
        GAME_WIDTH * 0.5,
        GAME_HEIGHT * 0.52,
        "customers",
        frameIndex(customerRow, 0)
      );
      const targetHeight = GAME_HEIGHT * 0.45;
      customer.setScale(targetHeight / customer.height);
      const counterY = 720;
      const customerTargetY = counterY - customer.displayHeight * 0.5;
      const entryY = counterY + customer.displayHeight * 0.6;
      customer.y = entryY;
      uiRoot.add(customer);
      this.applyCustomerCrop(customer, counterY);

      this.currentOrder = this.getRandomOrder();
      orderBubble = createBubble(this, { textParts: this.buildOrderParts(this.currentOrder) });
      const bubblePos = getBubblePosition(customer);
      orderBubble.setPosition(bubblePos.x, bubblePos.y);
      orderBubble.setVisible(false);
      uiRoot.add(orderBubble);

      this.ui.customer = customer;
      this.ui.bubble = orderBubble;
      this.ui.bakedPizza = null;

      this.animateCustomerIn(customer, customerTargetY, counterY, () => {
        const updatedPos = getBubblePosition(customer);
        orderBubble.setPosition(updatedPos.x, updatedPos.y);
        orderBubble.setVisible(true);
        this.setActionButton(actionButton, {
          label: "I'm on it!",
          onClick: () => {
            GameState.currentCustomer = {
              id: Date.now(),
              spriteKey: "customers",
              frameRow: customerRow,
              frameIndex: frameIndex(customerRow, 0),
            };
            GameState.currentOrder = { ingredients: this.currentOrder };
            this.scene.start("KitchenScene");
          },
          enabled: true,
          visible: true,
        });
        this.updateUI();
      });
    };

    if (!hasExistingOrder) {
      this.setActionButton(actionButton, {
        label: "Next customer",
        onClick: startFreshCustomer,
        enabled: true,
        visible: true,
      });
      return;
    }
    const existingRow = hasExistingOrder
      ? GameState.currentCustomer.frameRow ?? parseLegacyCustomerRow(GameState.currentCustomer.spriteKey)
      : null;
    customerRow = existingRow ?? Phaser.Math.Between(0, 5);
    customer = this.add.sprite(
      GAME_WIDTH * 0.5,
      GAME_HEIGHT * 0.52,
      "customers",
      frameIndex(customerRow, 0)
    );
    const targetHeight = GAME_HEIGHT * 0.45;
    customer.setScale(targetHeight / customer.height);
    const customerTargetY = counterY - customer.displayHeight * 0.5;
    customer.y = hasExistingOrder ? customerTargetY : counterY;
    uiRoot.add(customer);
    this.applyCustomerCrop(customer, counterY);

    this.currentOrder = hasExistingOrder ? GameState.currentOrder.ingredients : this.getRandomOrder();

    const shouldScoreOrder = hasExistingOrder;
    orderBubble = createBubble(this, { textParts: this.buildOrderParts(this.currentOrder) });
    const bubblePos = getBubblePosition(customer);
    orderBubble.setPosition(bubblePos.x, bubblePos.y);
    uiRoot.add(orderBubble);
    orderBubble.setVisible(false);

    let resultBubble = null;
    let customerEntranceDone = false;
    let pendingResult = false;
    let resultShown = false;
    // Show the result bubble and update state after serving.
    const showResult = () => {
      if (!customerEntranceDone) {
        pendingResult = true;
        return;
      }
      if (resultShown) {
        return;
      }
      resultShown = true;
      const correct = applyOrderResult(customer, customerRow, this.currentOrder, GameState.madePizza);
      const message = correct ? "YAY!" : "Oh no! I wanted ";
      if (correct) {
        AudioManager.playSfx("yay");
      }
      if (resultBubble) {
        resultBubble.destroy();
      }
      const baseColor = Theme.text.bubble.color;
      const textParts = correct
        ? [{ text: message, color: baseColor }]
        : [{ text: message, color: baseColor }, ...this.buildIngredientParts(this.currentOrder)];
      resultBubble = createBubble(this, { textParts });
      const resultPos = getBubblePosition(customer);
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
          if (orderBubble) {
            orderBubble.setVisible(false);
          }

          const exitY = counterY + customer.displayHeight * 0.6;
          this.animateCustomerOut(customer, exitY, counterY, () => {
            if (bakedPizza) {
              bakedPizza.destroy();
              bakedPizza = null;
            }
            if (resultBubble) {
              resultBubble.destroy();
              resultBubble = null;
            }
            if (orderBubble) {
              orderBubble.destroy();
            }
            if (customer) {
              customer.destroy();
            }

            customerRow = Phaser.Math.Between(0, 5);
            customer = this.add.sprite(
              GAME_WIDTH * 0.5,
              GAME_HEIGHT * 0.52,
              "customers",
              frameIndex(customerRow, 0)
            );
            customer.setScale(targetHeight / customer.height);
            customer.y = exitY;
            uiRoot.add(customer);
            this.applyCustomerCrop(customer, counterY);

            this.currentOrder = this.getRandomOrder();
            const nextBubble = createBubble(this, { textParts: this.buildOrderParts(this.currentOrder) });
            const nextPos = getBubblePosition(customer);
            nextBubble.setPosition(nextPos.x, nextPos.y);
            nextBubble.setVisible(false);
            uiRoot.add(nextBubble);

            this.ui.customer = customer;
            this.ui.bubble = nextBubble;
            this.ui.bakedPizza = bakedPizza;

            this.setActionButton(actionButton, {
              label: "I'm on it!",
              onClick: () => {
                GameState.currentCustomer = {
                  id: Date.now(),
                  spriteKey: "customers",
                  frameRow: customerRow,
                  frameIndex: frameIndex(customerRow, 0),
                };
                GameState.currentOrder = { ingredients: this.currentOrder };
                this.scene.start("KitchenScene");
              },
            });

            customerEntranceDone = false;
            pendingResult = false;
            resultShown = false;
            this.time.delayedCall(1000, () => {
              this.animateCustomerIn(customer, customerTargetY, counterY, () => {
                customerEntranceDone = true;
                const updatedPos = getBubblePosition(customer);
                nextBubble.setPosition(updatedPos.x, updatedPos.y);
                nextBubble.setVisible(true);
                this.setActionButton(actionButton, { visible: true, enabled: true, active: true });
                this.updateUI();
              });
            });
          });
        },
        visible: true,
        enabled: true,
      });
      this.updateUI();
    };

    if (GameState.madePizza && GameState.madePizza.snapshotKey) {
      const snapshotKey = GameState.madePizza.snapshotKey;
      if (this.textures.exists(snapshotKey)) {
        bakedPizza = this.add.image(GAME_WIDTH * 0.75, 820, snapshotKey);
        bakedPizza.setScale(1.55);
        uiRoot.add(bakedPizza);
        const targetY = bakedPizza.y;
        bakedPizza.y = GAME_HEIGHT + bakedPizza.displayHeight * 0.5;
        this.tweens.add({
          targets: bakedPizza,
          y: targetY,
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
    if (shouldScoreOrder && !bakedPizza) {
      showResult();
    }

    this.ui.customer = customer;
    this.ui.bubble = orderBubble;
    this.ui.bakedPizza = bakedPizza;
    this.updateUI();

    customerEntranceDone = true;
    if (pendingResult) {
      showResult();
    }
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
  //#endregion

  //#region Customer animation
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
  // Random order of 1-4 ingredients.
  getRandomOrder() {
    const count = Phaser.Math.Between(1, 4);
    const pool = Phaser.Utils.Array.Shuffle([...ENABLED_INGREDIENTS]);
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
