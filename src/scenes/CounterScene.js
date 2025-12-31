import { ENABLED_INGREDIENTS, GAME_HEIGHT, GAME_WIDTH, INGREDIENT_COLORS } from "../constants.js";
import { GameState } from "../state.js";
import { createButton } from "../ui/UIButton.js";
import { createBubble } from "../ui/UIBubble.js";
import { Theme } from "../ui/theme.js";
import { applyCoverLayout, screenToUi } from "../ui/layout.js";

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
    const uiRoot = this.add.container(0, 0);
    applyCoverLayout(this, bg, uiRoot);

    const customerKey = `customer${Phaser.Math.Between(1, 5)}`;
    const customer = this.add.image(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.52, customerKey);
    const targetHeight = GAME_HEIGHT * 0.45;
    customer.setScale(targetHeight / customer.height);
    const counterY = 720;
    customer.y = counterY - customer.displayHeight * 0.5;
    uiRoot.add(customer);

    this.currentOrder = this.getRandomOrder();

    // draw bubble with order text
    const bubble = createBubble(this, { textParts: this.buildOrderParts(this.currentOrder) });
    bubble.setPosition(
      customer.x + customer.displayWidth * 0.2,
      customer.y - customer.displayHeight * 0.5 - 30
    );
    uiRoot.add(bubble);

    // draw confirm button
    const confirmBtn = createButton(this, {
      width: 260,
      height: 90,
      label: "OK!",
      textVariant: "label",
      onClick: () => {
        GameState.currentCustomer = { id: Date.now(), type: customerKey, spriteKey: customerKey };
        GameState.currentOrder = { ingredients: this.currentOrder };
        this.scene.start("KitchenScene");
      },
    });
    uiRoot.add(confirmBtn);

    const layoutButtons = () => {
      const target = screenToUi(uiRoot, this.scale.width * 0.5, this.scale.height * 0.92);
      confirmBtn.setPosition(target.x, target.y);
    };
    layoutButtons();
    this.scale.on("resize", layoutButtons);

    this.ui = { root: uiRoot, customer, bubble, confirmBtn };
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
  }

  // Random order of 1-4 ingredients.
  getRandomOrder() {
    const count = Phaser.Math.Between(1, 4);
    const pool = Phaser.Utils.Array.Shuffle([...ENABLED_INGREDIENTS]);
    return pool.slice(0, count);
  }

  buildOrderParts(ingredients) {
    const parts = [];
    const baseColor = Theme.text.bubble.color;
    parts.push({ text: "Hi, I'd like a pizza with ", color: baseColor });
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
}

export default CounterScene;
