package com.epc;
import jakarta.persistence.*;
@Entity @Table(name = "master_items")
public class MasterItem {
  @Id @GeneratedValue public Long id;
  public String type; // BRAND, CATEGORY, COLOR
  public String name; public String extra; // extra = hex for colors
}
