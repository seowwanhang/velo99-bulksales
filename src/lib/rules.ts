/**
 * Core Business Rules Engine
 * Enforces:
 *  - discount-calculation-rules (Dealer Tiers, Volume Bonus, Profit Formula, RBAC Caps)
 *  - inventory-alert-rules (Stock Status Levels, Suggested Reorder Formula, Oversell Guards)
 *  - 99bulksales.my order thresholds (RM MOV & CBM Free Delivery progress)
 */

export type DealerTierId = 'platinum' | 'gold' | 'silver' | 'standard';
export type StockStatus = 'CRITICAL' | 'WARNING' | 'HEALTHY';

export const DEALER_TIERS: Record<
  DealerTierId,
  { id: DealerTierId; label: string; discountRate: number; defaultCreditLimit: number }
> = {
  platinum: { id: 'platinum', label: 'Platinum Dealer', discountRate: 0.15, defaultCreditLimit: 120000 },
  gold: { id: 'gold', label: 'Gold Dealer', discountRate: 0.10, defaultCreditLimit: 60000 },
  silver: { id: 'silver', label: 'Silver Dealer', discountRate: 0.05, defaultCreditLimit: 30000 },
  standard: { id: 'standard', label: 'Standard Dealer', discountRate: 0.0, defaultCreditLimit: 12000 },
};

export const MAX_AUTO_DISCOUNT = 0.20;
export const MAX_ADMIN_DISCOUNT = 0.25;

export function getStockStatus(stock: number, minStock: number): StockStatus {
  const halfMin = Math.floor(minStock * 0.5);
  if (stock === 0 || stock <= halfMin) return 'CRITICAL';
  if (stock <= minStock) return 'WARNING';
  return 'HEALTHY';
}

export function getSuggestedReorderQty(stock: number, minStock: number): number {
  const targetStock = Math.max(minStock * 2, minStock + 10);
  return Math.max(targetStock - stock, minStock);
}

export interface OrderCalcLine {
  unitPrice: number;
  costPrice: number;
  qty: number;
  unitsPerCarton: number;
  isBicycle: boolean;
  cbm: number;
}

export interface TierDiscountSettings {
  platinumDiscountPct?: number | null;
  goldDiscountPct?: number | null;
  silverDiscountPct?: number | null;
  standardDiscountPct?: number | null;
  volumeBonus10Pct?: number | null;
  volumeBonus20Pct?: number | null;
}

export interface ThresholdSettings extends TierDiscountSettings {
  minOrderValue: number;
  freeDeliveryCbm: number;
  standardShippingFee: number;
}

function clampRate(pct: number | null | undefined, fallbackRate: number, maxRate: number): number {
  if (pct === undefined || pct === null || Number.isNaN(Number(pct))) return fallbackRate;
  return Math.max(0, Math.min(Number(pct) / 100, maxRate));
}

export function getResolvedDealerTiers(settings?: TierDiscountSettings) {
  return {
    platinum: {
      ...DEALER_TIERS.platinum,
      discountRate: clampRate(settings?.platinumDiscountPct, DEALER_TIERS.platinum.discountRate, MAX_AUTO_DISCOUNT),
    },
    gold: {
      ...DEALER_TIERS.gold,
      discountRate: clampRate(settings?.goldDiscountPct, DEALER_TIERS.gold.discountRate, MAX_AUTO_DISCOUNT),
    },
    silver: {
      ...DEALER_TIERS.silver,
      discountRate: clampRate(settings?.silverDiscountPct, DEALER_TIERS.silver.discountRate, MAX_AUTO_DISCOUNT),
    },
    standard: {
      ...DEALER_TIERS.standard,
      discountRate: clampRate(settings?.standardDiscountPct, DEALER_TIERS.standard.discountRate, MAX_AUTO_DISCOUNT),
    },
  };
}

export function calculateOrderFinancials(params: {
  items: OrderCalcLine[];
  tierId: string;
  fulfillment: 'delivery' | 'pickup';
  settings: ThresholdSettings;
  adminCustomDiscountRate?: number | null;
}) {
  const resolvedTiers = getResolvedDealerTiers(params.settings);
  const tier = resolvedTiers[(params.tierId as DealerTierId) || 'standard'] ?? resolvedTiers.standard;
  const totalBikes = params.items.reduce(
    (sum, i) => sum + (i.isBicycle ? i.unitsPerCarton * i.qty : 0),
    0
  );
  const totalCartons = params.items.reduce((sum, i) => sum + i.qty, 0);
  const totalCbm = Number(
    params.items.reduce((sum, i) => sum + i.cbm * i.qty, 0).toFixed(2)
  );

  // Volume Bonus: >=20 bikes => default +3%, >=10 bikes => default +2%, auto cap 20%
  const bonus10 = clampRate(params.settings.volumeBonus10Pct, 0.02, 0.10);
  const bonus20 = clampRate(params.settings.volumeBonus20Pct, 0.03, 0.10);
  let volumeBonus = 0;
  if (totalBikes >= 20) volumeBonus = bonus20;
  else if (totalBikes >= 10) volumeBonus = bonus10;

  const autoDiscountRate = Math.min(tier.discountRate + volumeBonus, MAX_AUTO_DISCOUNT);
  const discountRate =
    params.adminCustomDiscountRate !== undefined &&
    params.adminCustomDiscountRate !== null &&
    !Number.isNaN(params.adminCustomDiscountRate)
      ? Math.max(0, Math.min(params.adminCustomDiscountRate, MAX_ADMIN_DISCOUNT))
      : autoDiscountRate;

  // Exact financial & profit formula
  const subtotal = Number(
    params.items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0).toFixed(2)
  );
  const discountAmount = Number((subtotal * discountRate).toFixed(2));
  const goodsRevenue = Number((subtotal - discountAmount).toFixed(2));

  const qualifiesMov = goodsRevenue >= params.settings.minOrderValue;
  const qualifiesFreeDelivery =
    qualifiesMov && totalCbm >= params.settings.freeDeliveryCbm;

  let shippingFee = 0;
  if (params.fulfillment === 'delivery' && !qualifiesFreeDelivery && subtotal > 0) {
    shippingFee = params.settings.standardShippingFee;
  }

  const totalAmount = Number((goodsRevenue + shippingFee).toFixed(2));
  const totalCost = Number(
    params.items.reduce((sum, i) => sum + i.costPrice * i.qty, 0).toFixed(2)
  );
  const netProfit = Number((goodsRevenue - totalCost - shippingFee).toFixed(2));
  const profitMargin =
    goodsRevenue > 0 ? Number(((netProfit / goodsRevenue) * 100).toFixed(1)) : 0;

  const pickupPct = Math.min(
    100,
    params.settings.minOrderValue > 0
      ? Math.round((goodsRevenue / params.settings.minOrderValue) * 100)
      : 100
  );
  const cbmPct = Math.min(
    100,
    params.settings.freeDeliveryCbm > 0
      ? Math.round((totalCbm / params.settings.freeDeliveryCbm) * 100)
      : 100
  );
  const freeDeliveryPct = qualifiesMov ? cbmPct : Math.min(pickupPct, cbmPct);

  return {
    tierDiscount: tier.discountRate,
    volumeBonus,
    autoDiscountRate,
    discountRate,
    totalBikes,
    totalCartons,
    totalCbm,
    subtotal,
    discountAmount,
    goodsRevenue,
    shippingFee,
    totalAmount,
    totalCost,
    netProfit,
    profitMargin,
    qualifiesMov,
    qualifiesFreeDelivery,
    pickupPct,
    freeDeliveryPct,
  };
}

export function formatRM(value: number): string {
  return `RM ${Number(value || 0).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
