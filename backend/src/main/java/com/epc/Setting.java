package com.epc;
import jakarta.persistence.*;
@Entity @Table(name = "settings")
public class Setting { @Id public String name; public String val; }
