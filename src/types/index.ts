export interface RecipeRequirement {
  text: string;
  markdown: string;
  group?: string | null;
  kind: 'ingredient' | 'tool' | 'unknown' | string;
}

export interface Ingredient {
  name: string;
  text: string;
  optional: boolean;
  source?: string | null;
  table?: Record<string, string>;
}

export interface Step {
  kind: 'step' | 'heading' | string;
  title?: string | null;
  description: string;
}

/** HowToCook assets schema v2. */
export interface Recipe {
  schemaVersion: 2;
  id: string;
  legacyIds: string[];
  name: string;
  description?: string | null;
  category: string;
  categoryName: string;
  difficulty: number;
  estimatedCaloriesKcal?: number | null;
  requirements: RecipeRequirement[];
  requirementsMarkdown?: string | null;
  ingredients: Ingredient[];
  tools: string[];
  calculationMarkdown?: string | null;
  calculationNotes: string[];
  steps: Step[];
  operationMarkdown?: string | null;
  tips?: string | null;
  warnings: string[];
  additionalMarkdown?: string | null;
  images: string[];
  externalImages: string[];
  source?: unknown;
  hash: string;
}

export interface RecipeBundle {
  schemaVersion: 2;
  dataVersion: string;
  generatedAt: string;
  recipes: Recipe[];
}

export interface SimpleRecipe {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  categoryName: string;
  difficulty: number;
  estimatedCaloriesKcal?: number | null;
  ingredients: Pick<Ingredient, 'name' | 'text' | 'optional'>[];
}

export interface NameOnlyRecipe {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  categoryName: string;
  difficulty: number;
  estimatedCaloriesKcal?: number | null;
}

export interface MealPlan {
  weekdays: Array<DayPlan>;
  weekend: Array<DayPlan>;
  groceryList: GroceryList;
}

export interface DayPlan {
  day: string;
  breakfast: SimpleRecipe[];
  lunch: SimpleRecipe[];
  dinner: SimpleRecipe[];
}

export interface GroceryList {
  ingredients: Array<{
    name: string;
    amountExamples: string[];
    recipeCount: number;
    recipes: string[];
  }>;
  shoppingPlan: {
    fresh: string[];
    pantry: string[];
    spices: string[];
    others: string[];
  };
}

export interface DishRecommendation {
  peopleCount: number;
  meatDishCount: number;
  vegetableDishCount: number;
  dishes: SimpleRecipe[];
  message: string;
}
