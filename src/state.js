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
  pizzasMade: 0,
};
