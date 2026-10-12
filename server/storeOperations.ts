import * as db from "./db";
import { buildStoreAlerts } from "./storeAlerts";
import { buildStoreInsights } from "./storeInsights";

const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD of `now` shifted by `offsetDays`, on the Asia/Jakarta calendar. */
export function jakartaDate(now: Date, offsetDays = 0) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now.getTime() + offsetDays * DAY_MS));
}

/** Last `days` Jakarta calendar days including today, and the equally long period before it. */
export function rollingJakartaPeriods(now: Date, days: number) {
  return {
    current: { startDate: jakartaDate(now, -(days - 1)), endDate: jakartaDate(now) },
    previous: { startDate: jakartaDate(now, -(2 * days - 1)), endDate: jakartaDate(now, -days) },
  };
}

export async function getStoreAlerts(now = new Date()) {
  const { current } = rollingJakartaPeriods(now, 30);
  const [ingredients, products, recipes, opname, settings, intelligence] = await Promise.all([
    db.listIngredients(), db.listProducts(), db.listRecipes(), db.getOpenStockOpnameSummary(), db.getSettings(), db.getInventoryIntelligence(current),
  ]);
  return {
    generatedAt: now,
    ...buildStoreAlerts({
      ingredients, products, recipes, opname,
      variance: intelligence.rows,
      thresholds: { opnameWarningAgeDays: settings.opnameWarningAgeDays, opnameCriticalAgeDays: settings.opnameCriticalAgeDays },
    }),
  };
}

export async function getStoreInsights(days = 30, now = new Date()) {
  const periods = rollingJakartaPeriods(now, days);
  const [current, previous, products, ingredients] = await Promise.all([
    db.getFinancialDashboard(periods.current), db.getFinancialDashboard(periods.previous), db.listProducts(), db.listIngredients(),
  ]);
  const consumption = await db.getIngredientConsumption(current.dateStart, current.dateEnd);
  return { generatedAt: now, periods, ...buildStoreInsights({ days, current, previous, products, ingredients, consumption }) };
}
