package com.epc;
import org.springframework.http.HttpStatus; import org.springframework.messaging.simp.SimpMessagingTemplate; import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional; import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal; import java.math.RoundingMode; import java.time.Instant; import java.util.List;

@Service
public class OrderService {
  public record Line(Long productId, int qty) {}
  private final ProductRepo products; private final OrderRepo orders; private final PaymentRepo payments; private final SimpMessagingTemplate ws; private final AuditService audit; private final NoticeService notices;
  OrderService(ProductRepo p, OrderRepo o, PaymentRepo pay, SimpMessagingTemplate ws, AuditService a, NoticeService n) { products = p; orders = o; payments = pay; this.ws = ws; audit = a; notices = n; }
  private static ResponseStatusException err(HttpStatus s, String m) { return new ResponseStatusException(s, m); }
  private CustomerOrder find(Long id) { return orders.findById(id).orElseThrow(() -> err(HttpStatus.NOT_FOUND, "We couldn't find that order.")); }

  /** Creates an unpaid (PENDING) order and reserves stock. Prices are always calculated on the server. */
  @Transactional
  public CustomerOrder create(List<Line> lines, String customer) {
    if (lines == null || lines.isEmpty()) throw err(HttpStatus.BAD_REQUEST, "Your cart is empty.");
    CustomerOrder o = new CustomerOrder(); o.customer = customer;
    for (Line l : lines) {
      Product p = products.findById(l.productId()).orElseThrow(() -> err(HttpStatus.NOT_FOUND, "One of the products is no longer available."));
      if (l.qty() <= 0 || p.stock < l.qty()) throw err(HttpStatus.CONFLICT, "Sorry, only " + p.stock + " left of " + p.name + ". Please reduce the quantity in your cart.");
      BigDecimal q = BigDecimal.valueOf(l.qty()), unit = Pricing.effective(p.price, p.salePercent == null ? 0 : p.salePercent);
      p.stock -= l.qty();
      OrderItem i = new OrderItem(); i.productId = p.id; i.name = p.name; i.qty = l.qty(); i.unitPrice = unit; i.listPrice = p.price;
      i.unitCost = p.cost != null ? p.cost : p.price.multiply(new BigDecimal("0.62")).setScale(2, RoundingMode.HALF_UP);
      o.items.add(i); o.total = o.total.add(unit.multiply(q)); o.discount = o.discount.add(p.price.subtract(unit).multiply(q));
      if (p.stock <= p.reorderLevel) notices.send("STAFF", "Low stock", p.name + " has only " + p.stock + " left.", "inv");
    }
    orders.save(o);
    ws.convertAndSend("/topic/orders", o); ws.convertAndSend("/topic/stock", products.lowStock());
    return o;
  }

  /** Called only by the payment flow (gateway confirmation) or the POS. Never exposed directly to customers. */
  @Transactional
  public CustomerOrder markPaid(Long id, String method, String ref) {
    CustomerOrder o = find(id);
    if (o.status != CustomerOrder.Status.PENDING) throw err(HttpStatus.CONFLICT, "This order has already been paid or closed.");
    Payment p = new Payment(); p.orderId = id; p.method = method; p.amount = o.total; payments.save(p);
    o.status = CustomerOrder.Status.PAID; o.paymentMethod = method; o.paymentRef = ref;
    notices.send(o.customer, "Payment received", "Order #" + id + " is paid. Thank you!", "orders");
    notices.send("STAFF", "New paid order #" + id, o.customer + " paid $" + o.total + " by " + method, "orders");
    ws.convertAndSend("/topic/orders", o); return o;
  }

  @Transactional
  public CustomerOrder pos(List<Line> lines, String method, String staff) {
    CustomerOrder o = create(lines, "walk-in");
    audit.log(staff, "POS_SALE", "ORDER#" + o.id, "$" + o.total + " " + method);
    o = markPaid(o.id, method, "POS-" + o.id); o.updatedBy = staff; o.updatedAt = Instant.now(); return o;
  }

  @Transactional
  public CustomerOrder cancel(Long id, String actor) {
    CustomerOrder o = find(id);
    if (o.status == CustomerOrder.Status.SHIPPED || o.status == CustomerOrder.Status.DELIVERED || o.status == CustomerOrder.Status.CANCELLED)
      throw err(HttpStatus.CONFLICT, "This order is already " + o.status.name().toLowerCase() + " and can't be cancelled.");
    String from = o.status.name();
    o.items.forEach(i -> products.findById(i.productId).ifPresent(p -> p.stock += i.qty));
    o.status = CustomerOrder.Status.CANCELLED; o.updatedBy = actor; o.updatedAt = Instant.now();
    audit.log(actor, "ORDER_STATUS", "ORDER#" + id, from + " -> CANCELLED");
    notices.send(o.customer, "Order #" + id + " cancelled", "Your order was cancelled and the items were returned to stock.", "orders");
    ws.convertAndSend("/topic/orders", o); ws.convertAndSend("/topic/stock", products.lowStock());
    return o;
  }

  @Transactional
  public CustomerOrder setStatus(Long id, CustomerOrder.Status to, String actor) {
    CustomerOrder o = find(id);
    if (o.status == CustomerOrder.Status.CANCELLED || o.status == CustomerOrder.Status.DELIVERED) throw err(HttpStatus.CONFLICT, "This order is already " + o.status.name().toLowerCase() + ", so its status can't be changed any more.");
    if (o.status == to) throw err(HttpStatus.CONFLICT, "The order is already " + to.name().toLowerCase() + ".");
    if (to == CustomerOrder.Status.CANCELLED) return cancel(id, actor);
    if (o.status == CustomerOrder.Status.PENDING) throw err(HttpStatus.CONFLICT, "This order is still waiting for payment. It can be processed after the customer pays (or cancelled).");
    String from = o.status.name(); o.status = to; o.updatedBy = actor; o.updatedAt = Instant.now();
    audit.log(actor, "ORDER_STATUS", "ORDER#" + id, from + " -> " + to.name());
    notices.send(o.customer, "Order #" + id + " update", "Your order is now: " + to.name().toLowerCase() + ".", "orders");
    ws.convertAndSend("/topic/orders", o); return o;
  }
}
