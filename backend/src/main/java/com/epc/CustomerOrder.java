package com.epc;
import jakarta.persistence.*; import java.math.BigDecimal; import java.time.Instant; import java.util.*;
@Entity @Table(name = "orders")
public class CustomerOrder {
  public enum Status { PENDING, PAID, PROCESSING, SHIPPED, DELIVERED, CANCELLED }
  @Id @GeneratedValue public Long id;
  @Convert(converter = StatusConverter.class) @Column(length = 20) public Status status = Status.PENDING;
  public BigDecimal total = BigDecimal.ZERO;
  public BigDecimal discount = BigDecimal.ZERO;
  public String customer; public String updatedBy; public Instant updatedAt;
  public String paymentMethod; public String paymentRef;
  public Instant createdAt = Instant.now();
  @OneToMany(cascade = CascadeType.ALL, fetch = FetchType.EAGER) @JoinColumn(name = "order_id")
  public List<OrderItem> items = new ArrayList<>();
}
