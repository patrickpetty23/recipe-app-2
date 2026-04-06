function parseFraction(str) {
  if (str == null) return null;
  const s = String(str).trim();
  if (!s) return null;

  const mixedMatch = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    return parseInt(mixedMatch[1], 10) + parseInt(mixedMatch[2], 10) / parseInt(mixedMatch[3], 10);
  }

  const fracMatch = s.match(/^(\d+)\/(\d+)$/);
  if (fracMatch) {
    return parseInt(fracMatch[1], 10) / parseInt(fracMatch[2], 10);
  }

  const num = parseFloat(s);
  return isNaN(num) ? null : num;
}

function gcd(a, b) {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

function toFractionString(value) {
  if (value == null) return null;
  if (value === Math.floor(value)) return String(value);

  const whole = Math.floor(value);
  let decimal = value - whole;

  const denominators = [2, 3, 4, 8];
  for (const d of denominators) {
    const n = Math.round(decimal * d);
    if (Math.abs(n / d - decimal) < 0.01) {
      const g = gcd(n, d);
      const num = n / g;
      const den = d / g;
      if (num === den) return String(whole + 1);
      if (whole > 0) return `${whole} ${num}/${den}`;
      return `${num}/${den}`;
    }
  }

  return String(Math.round(value * 100) / 100);
}

export function scaleIngredients(ingredients, multiplier) {
  return ingredients.map((ing) => {
    const parsed = parseFraction(ing.quantity);
    return {
      ...ing,
      quantity: parsed != null ? toFractionString(parsed * multiplier) : null,
    };
  });
}

export { parseFraction, toFractionString };
