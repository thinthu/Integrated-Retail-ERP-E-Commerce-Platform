package com.epc;
import com.fasterxml.jackson.annotation.JsonProperty; import jakarta.persistence.*; import jakarta.validation.constraints.*; import java.math.BigDecimal;
@Entity
public class Product {
  @Id @GeneratedValue public Long id;
  @NotBlank(message = "is required") @Column(unique = true) public String sku;
  @NotBlank(message = "is required") public String name;
  @NotNull(message = "is required") @DecimalMin(value = "0.0", message = "can't be negative") public BigDecimal price;
  @Min(value = 0, message = "can't be negative") public int stock;
  public int reorderLevel = 5;
  @Min(value = 0, message = "can't be negative") @Max(value = 90, message = "can't be above 90") public Integer salePercent = 0;
  public Long supplierId;
  public String category; public String imageUrl; public String brand; public String colors;
  @JsonProperty(access = JsonProperty.Access.WRITE_ONLY) public BigDecimal cost; // confidential: never sent to browsers
  @Column(length = 1500) public String description;
  @Column(length = 1000) public String specs;
}
