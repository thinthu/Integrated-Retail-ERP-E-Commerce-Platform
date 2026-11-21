package com.epc;
import com.lowagie.text.Document; import com.lowagie.text.Element; import com.lowagie.text.Font; import com.lowagie.text.PageSize; import com.lowagie.text.Paragraph; import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell; import com.lowagie.text.pdf.PdfPTable; import com.lowagie.text.pdf.PdfWriter;
import org.springframework.http.HttpHeaders; import org.springframework.http.HttpStatus; import org.springframework.http.MediaType; import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication; import org.springframework.web.bind.annotation.*; import org.springframework.web.server.ResponseStatusException;
import java.io.ByteArrayOutputStream; import java.time.ZoneId; import java.time.format.DateTimeFormatter;

@RestController @RequestMapping("/api/orders")
class ReceiptController {
  private final OrderRepo orders; ReceiptController(OrderRepo o) { orders = o; }
  private static PdfPCell cell(String t, Font f, int align) { PdfPCell c = new PdfPCell(new Phrase(t, f)); c.setHorizontalAlignment(align); c.setBorderWidth(0.4f); c.setPadding(4); return c; }
  @GetMapping("/{id}/receipt") ResponseEntity<byte[]> receipt(@PathVariable Long id, Authentication a) throws Exception {
    CustomerOrder o = orders.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "We couldn't find that order."));
    boolean staff = a.getAuthorities().stream().anyMatch(x -> !x.getAuthority().equals("ROLE_CUSTOMER"));
    if (!staff && !a.getName().equals(o.customer)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This receipt belongs to another account.");
    ByteArrayOutputStream out = new ByteArrayOutputStream(); Document d = new Document(PageSize.A5, 30, 30, 30, 30); PdfWriter.getInstance(d, out); d.open();
    Font h = new Font(Font.HELVETICA, 20, Font.BOLD), b = new Font(Font.HELVETICA, 10, Font.BOLD), n = new Font(Font.HELVETICA, 10);
    d.add(new Paragraph("KHIT RIDE", h)); d.add(new Paragraph("Receipt / Invoice #" + o.id, b));
    d.add(new Paragraph("Date: " + DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").format(o.createdAt.atZone(ZoneId.systemDefault())), n));
    d.add(new Paragraph("Customer: " + o.customer, n)); d.add(new Paragraph("Status: " + o.status + (o.paymentMethod != null ? "   Payment: " + o.paymentMethod + (o.paymentRef != null ? " (" + o.paymentRef + ")" : "") : ""), n)); d.add(new Paragraph(" "));
    PdfPTable t = new PdfPTable(new float[]{5, 1, 2, 2}); t.setWidthPercentage(100);
    t.addCell(cell("Item", b, Element.ALIGN_LEFT)); t.addCell(cell("Qty", b, Element.ALIGN_CENTER)); t.addCell(cell("Unit", b, Element.ALIGN_RIGHT)); t.addCell(cell("Amount", b, Element.ALIGN_RIGHT));
    for (OrderItem i : o.items) { t.addCell(cell(i.name, n, Element.ALIGN_LEFT)); t.addCell(cell("" + i.qty, n, Element.ALIGN_CENTER)); t.addCell(cell("$" + i.unitPrice, n, Element.ALIGN_RIGHT)); t.addCell(cell("$" + i.unitPrice.multiply(java.math.BigDecimal.valueOf(i.qty)), n, Element.ALIGN_RIGHT)); }
    d.add(t); d.add(new Paragraph(" "));
    if (o.discount != null && o.discount.signum() > 0) d.add(new Paragraph("You saved: $" + o.discount, n));
    d.add(new Paragraph("TOTAL: $" + o.total, h)); d.add(new Paragraph(" ")); d.add(new Paragraph("Thank you for riding with Khit Ride.", n)); d.close();
    return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=receipt-" + id + ".pdf").contentType(MediaType.APPLICATION_PDF).body(out.toByteArray());
  }
}
