package com.epc;
import jakarta.persistence.*; import java.math.BigDecimal;
@Entity
public class OrderItem {
  @Id @GeneratedValue public Long id;
  public Long productId; public String name; public int qty;
  public BigDecimal unitPrice;  // price actually charged (after discount)
  public BigDecimal listPrice;  // normal price
  public BigDecimal unitCost;   // cost price at the time of sale (for accurate profit)
}
