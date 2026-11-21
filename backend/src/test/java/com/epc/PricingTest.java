package com.epc;
import org.junit.jupiter.api.Test; import java.math.BigDecimal; import static org.junit.jupiter.api.Assertions.*;
class PricingTest {
  @Test void effectivePriceAppliesPercent() { assertEquals(new BigDecimal("80.00"), Pricing.effective(new BigDecimal("100.00"), 20)); }
  @Test void noDiscountKeepsPrice() { assertEquals(new BigDecimal("49.90"), Pricing.effective(new BigDecimal("49.90"), 0)); }
  @Test void maxSafeKeepsMinimumMargin() {
    BigDecimal price = new BigDecimal("100"), cost = new BigDecimal("62");
    int safe = Pricing.maxSafePercent(price, cost, 10); BigDecimal net = Pricing.effective(price, safe);
    assertTrue(net.subtract(cost).doubleValue() / net.doubleValue() >= 0.10 - 1e-9);
    BigDecimal next = Pricing.effective(price, safe + 1); assertTrue(next.subtract(cost).doubleValue() / next.doubleValue() < 0.10);
  }
  @Test void breakEvenNeverSellsBelowCost() { int be = Pricing.breakEvenPercent(new BigDecimal("100"), new BigDecimal("62")); assertTrue(Pricing.effective(new BigDecimal("100"), be).compareTo(new BigDecimal("62")) > 0); }
  @Test void zeroWhenCostEqualsPrice() { assertEquals(0, Pricing.maxSafePercent(new BigDecimal("50"), new BigDecimal("50"), 10)); }
}
