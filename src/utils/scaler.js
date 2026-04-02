export function scaleIngredients(ingredients, multiplier) {
  return ingredients.map((ing) => ({
    ...ing,
    quantity: ing.quantity != null ? ing.quantity * multiplier : null,
  }));
}
