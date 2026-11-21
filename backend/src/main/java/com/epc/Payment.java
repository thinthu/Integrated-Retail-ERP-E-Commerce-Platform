package com.epc;
import jakarta.persistence.*; import java.math.BigDecimal; import java.time.Instant;
@Entity
public class Payment {
  @Id @GeneratedValue public Long id;
  public Long orderId; public String method; public BigDecimal amount; public Instant paidAt = Instant.now();
}
