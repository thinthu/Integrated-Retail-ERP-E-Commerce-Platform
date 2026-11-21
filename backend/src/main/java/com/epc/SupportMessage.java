package com.epc;
import jakarta.persistence.*; import java.time.Instant;
@Entity
public class SupportMessage {
  @Id @GeneratedValue public Long id;
  public String customer; public String sender; // CUSTOMER or STAFF
  @Column(length = 2000) public String body;
  public Instant createdAt = Instant.now();
}
