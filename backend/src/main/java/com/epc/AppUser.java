package com.epc;
import jakarta.persistence.*;
@Entity @Table(name = "app_users")
public class AppUser {
  @Id @GeneratedValue public Long id;
  @Column(unique = true) public String username;
  public String passwordHash;
  public String role; // ADMIN, MANAGER, CASHIER, CUSTOMER
}
