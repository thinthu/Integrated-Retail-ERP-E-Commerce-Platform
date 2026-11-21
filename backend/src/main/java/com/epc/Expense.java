package com.epc;
import jakarta.persistence.*; import java.math.BigDecimal; import java.time.Instant;
@Entity @Table(name = "expenses")
public class Expense {
  @Id @GeneratedValue public Long id;
  public String category; public BigDecimal amount; public String note, createdBy; public Instant spentAt = Instant.now();
}
