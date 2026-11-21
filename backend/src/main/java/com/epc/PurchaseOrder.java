package com.epc;
import jakarta.persistence.*; import java.math.BigDecimal; import java.time.Instant; import java.util.*;
@Entity @Table(name = "purchase_orders")
public class PurchaseOrder {
  @Id @GeneratedValue public Long id;
  public Long supplierId; public String supplierName;
  public String status = "DRAFT"; // DRAFT, ORDERED, RECEIVED, CANCELLED
  public BigDecimal total = BigDecimal.ZERO; public boolean paid;
  public String createdBy, receivedBy; public Instant createdAt = Instant.now(), receivedAt, paidAt;
  @OneToMany(cascade = CascadeType.ALL, fetch = FetchType.EAGER) @JoinColumn(name = "po_id")
  public List<PoLine> lines = new ArrayList<>();
}
