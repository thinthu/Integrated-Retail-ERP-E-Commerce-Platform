package com.epc;
import jakarta.persistence.AttributeConverter; import jakarta.persistence.Converter;
@Converter
public class StatusConverter implements AttributeConverter<CustomerOrder.Status, String> {
  public String convertToDatabaseColumn(CustomerOrder.Status s) { return s == null ? null : s.name(); }
  public CustomerOrder.Status convertToEntityAttribute(String v) { return v == null ? null : CustomerOrder.Status.valueOf(v); }
}
