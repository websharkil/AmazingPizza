import { ENABLED_INGREDIENTS, GAME_HEIGHT, GAME_WIDTH, INGREDIENT_COLORS } from "../constants.js";
import { GameState } from "../state.js";
import { createButton } from "../ui/UIButton.js";
import { createBubble } from "../ui/UIBubble.js";
import { createCornerLabel } from "../ui/UILabel.js";
import { Theme } from "../ui/theme.js";
import { applyCoverLayout, screenToUi } from "../ui/layout.js";

function frameIndex(row, col, cols = 3) {
  return row * cols + col;
}

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

function getBubblePosition(customer) {
  return {
    x: customer.x + customer.displayWidth * 0.2,
    y: customer.y - customer.displayHeight * 0.5 - 30,
  };
}

class CounterScene extends Phaser.Scene {
  constructor() {
    super({ key: "CounterScene" });
  }

  init(data) {
    this.hideConfirm = Boolean(data && data.hideConfirm);
  }

  preload() {
    this.load.image("counter_bg", "assets/bg/counter_bg.png");
    this.load.spritesheet("customers", "assets/customers/customers-sprite.png", {
      frameWidth: 280,
      frameHeight: 360,
    });
  }

  create() {
    const bg = this.add.image(0, 0, "counter_bg");
    const uiRoot = this.add.container(0, 0);
    applyCoverLayout(this, bg, uiRoot);
    this.input.setDefaultCursor("default");

    const hasExistingOrder = Boolean(GameState.currentCustomer && GameState.currentOrder);
    const existingRow = hasExistingOrder
      ? GameState.currentCustomer.frameRow ?? parseLegacyCustomerRow(GameState.currentCustomer.spriteKey)
      : null;
    let customerRow = existingRow ?? Phaser.Math.Between(0, 5);
    let customer = this.add.sprite(
      GAME_WIDTH * 0.5,
      GAME_HEIGHT * 0.52,
      "customers",
      frameIndex(customerRow, 0)
    );
    const targetHeight = GAME_HEIGHT * 0.45;
    customer.setScale(targetHeight / customer.height);
    const counterY = 720;
    customer.y = counterY - customer.displayHeight * 0.5;
    uiRoot.add(customer);

    this.currentOrder = hasExistingOrder ? GameState.currentOrder.ingredients : this.getRandomOrder();

    const shouldScoreOrder = hasExistingOrder;
    const orderBubble = createBubble(this, { textParts: this.buildOrderParts(this.currentOrder) });
    const bubblePos = getBubblePosition(customer);
    orderBubble.setPosition(bubblePos.x, bubblePos.y);
    uiRoot.add(orderBubble);
    if (hasExistingOrder) {
      orderBubble.setVisible(false);
    }

    let resultBubble = null;
    const showResult = () => {
      const correct = applyOrderResult(customer, customerRow, this.currentOrder, GameState.madePizza);
      const message = correct ? "YAY!" : "Oh no! I wanted ";
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
      if (actionButton) {
        actionButton.setLabel("Next customer.");
        actionButton.onClick(() => {
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
          customer.y = counterY - customer.displayHeight * 0.5;
          uiRoot.add(customer);

          this.currentOrder = this.getRandomOrder();
          const nextBubble = createBubble(this, { textParts: this.buildOrderParts(this.currentOrder) });
          const nextPos = getBubblePosition(customer);
          nextBubble.setPosition(nextPos.x, nextPos.y);
          uiRoot.add(nextBubble);

          this.ui.customer = customer;
          this.ui.bubble = nextBubble;
          this.ui.bakedPizza = bakedPizza;

          actionButton.setLabel("OK!");
          actionButton.onClick(() => {
            GameState.currentCustomer = {
              id: Date.now(),
              spriteKey: "customers",
              frameRow: customerRow,
              frameIndex: frameIndex(customerRow, 0),
            };
            GameState.currentOrder = { ingredients: this.currentOrder };
            this.scene.start("KitchenScene");
          });

          this.updateUI();
        });
        actionButton.setVisible(true);
        actionButton.setActive(true);
        actionButton.setEnabled(true);
      }
      this.updateUI();
    };

    let bakedPizza = null;
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

    let actionButton = null;
    if (!this.hideConfirm || hasExistingOrder) {
      actionButton = createButton(this, {
        width: 260,
        height: 90,
        label: hasExistingOrder ? "Next customer" : "I'm on it!",
        textVariant: "label",
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
      uiRoot.add(actionButton);

      const layoutButtons = () => {
        const target = screenToUi(uiRoot, this.scale.width * 0.5, this.scale.height * 0.92);
        actionButton.setPosition(target.x, target.y);
      };
      layoutButtons();
      this.scale.on("resize", layoutButtons);
      if (hasExistingOrder) {
        actionButton.setVisible(false);
        actionButton.setActive(false);
        actionButton.setEnabled(false);
      }
    }

    const scoreLabel = createCornerLabel(this, "", "score", 0);

    this.ui = { root: uiRoot, customer, bubble: orderBubble, confirmBtn: actionButton, scoreLabel, bakedPizza };
    this.updateUI();
  }

  update() {
    // Game loop updates will go here.
  }

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

  // Random order of 1-4 ingredients.
  getRandomOrder() {
    const count = Phaser.Math.Between(1, 4);
    const pool = Phaser.Utils.Array.Shuffle([...ENABLED_INGREDIENTS]);
    return pool.slice(0, count);
  }

  //#region order text builders
  buildOrderParts(ingredients) {
    const parts = [];
    const baseColor = Theme.text.bubble.color;
    parts.push({ text: "Hi, I'd like a pizza with ", color: baseColor });
    parts.push(...this.buildIngredientParts(ingredients));
    return parts;
  }

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

  getIngredientColor(ingredient) {
    return INGREDIENT_COLORS[ingredient] || 0xcccccc;
  }
  //#endregion
}

export default CounterScene;
