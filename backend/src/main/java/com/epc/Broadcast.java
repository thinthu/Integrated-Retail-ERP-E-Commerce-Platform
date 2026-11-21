package com.epc;
import jakarta.persistence.*; import java.time.Instant;
@Entity @Table(name = "broadcasts")
public class Broadcast {
  @Id @GeneratedValue public Long id;
  public String title; @Column(length = 500) public String body; public String link, audience, sentBy; public int recipients; public Instant createdAt = Instant.now();
}
