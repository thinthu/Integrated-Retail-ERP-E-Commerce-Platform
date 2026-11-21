package com.epc;
import java.math.BigDecimal; import java.math.RoundingMode;
/** Discount maths used by checkout and by the owner's discount planner. */
final class Pricing {
  private Pricing() { }
  static BigDecimal effective(BigDecimal price, int pct) { return price.multiply(BigDecimal.valueOf(100 - pct)).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP); }
  /** Largest whole-number discount (%) that still leaves at least minMarginPct margin on the discounted price. */
  static int maxSafePercent(BigDecimal price, BigDecimal cost, double minMarginPct) {
    if (price == null || cost == null || price.signum() <= 0) return 0;
    double minNet = cost.doubleValue() / (1 - minMarginPct / 100.0);
    return (int) Math.max(0, Math.min(90, Math.floor((1 - minNet / price.doubleValue()) * 100)));
  }
  /** Largest whole-number discount (%) before the item is sold at or below cost. */
  static int breakEvenPercent(BigDecimal price, BigDecimal cost) {
    if (price == null || cost == null || price.signum() <= 0) return 0;
    return (int) Math.max(0, Math.min(90, Math.ceil((1 - cost.doubleValue() / price.doubleValue()) * 100) - 1));
  }
}
