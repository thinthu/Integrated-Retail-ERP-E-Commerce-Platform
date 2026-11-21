package com.epc;
import jakarta.persistence.*; import java.math.BigDecimal; import java.time.Instant;
@Entity @Table(name = "payment_sessions")
public class PaymentSession {
  @Id public String id; public Long orderId; public String method; public BigDecimal amount; public String status = "PENDING"; public String ref; public Instant createdAt = Instant.now();
}
