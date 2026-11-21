package com.epc;
import jakarta.persistence.*; import java.math.BigDecimal;
@Entity @Table(name = "po_lines")
public class PoLine {
  @Id @GeneratedValue public Long id;
  public Long productId; public String name; public int qty; public BigDecimal unitCost;
}
