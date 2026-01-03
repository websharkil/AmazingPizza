export const GameState = {
  currentCustomer: null,
  currentOrder: null,
  madePizza: {
    ingredients: new Set(),
    baked: false,
    cut: false,
    boxed: false,
    score: 0,
    snapshotKey: null,
    snapshotSize: null,
  },
  enabledIngredients: ["sauce", "cheese"],
  audio: {
    musicEnabled: true,
    sfxEnabled: true,
    musicVolume: 1,
    sfxVolume: 1,
  },
  pizzasMade: 0,
};
