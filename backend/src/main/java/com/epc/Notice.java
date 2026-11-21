package com.epc;
import jakarta.persistence.*; import java.time.Instant;
@Entity @Table(name = "notices")
public class Notice {
  @Id @GeneratedValue public Long id;
  public String audience; // a username, or STAFF for all staff
  public String title;
  @Column(length = 500) public String body;
  public String link;     // where a click should go: chat, orders, sale, product:ID, inbox:USER ...
  public boolean seen;
  public Instant createdAt = Instant.now();
}
