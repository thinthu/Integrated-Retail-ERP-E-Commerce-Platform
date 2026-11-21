package com.epc;
import jakarta.persistence.*; import java.time.Instant;
@Entity @Table(name = "audit_log")
public class AuditLog {
  @Id @GeneratedValue public Long id;
  public String actor, action, target;
  @Column(length = 500) public String detail;
  public Instant createdAt = Instant.now();
}
