package com.epc;
import jakarta.persistence.*;
@Entity @Table(name = "suppliers")
public class Supplier {
  @Id @GeneratedValue public Long id;
  public String name, contact, phone, email, country;
}
