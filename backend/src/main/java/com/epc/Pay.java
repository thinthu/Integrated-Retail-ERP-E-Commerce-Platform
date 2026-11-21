package com.epc;
import org.springframework.http.HttpStatus; import org.springframework.security.core.Authentication; import org.springframework.web.bind.annotation.*; import org.springframework.web.server.ResponseStatusException;
import java.util.*;

/**
 * SANDBOX payment gateway. It follows the same flow as a real gateway (create a payment session -> customer approves in the
 * provider's app/page -> provider confirms to the server -> order becomes PAID) but no real money moves.
 * To go live, replace start() with the provider's "create payment" API call and replace confirm() with the provider's signed
 * webhook (KBZPay / Wave / Stripe all work this way), verifying the signature before calling OrderService.markPaid.
 */
@RestController @RequestMapping("/api/payments")
class PaymentController {
  record Start(Long orderId, String method) {}
  record Confirm(boolean approved) {}
  private static final Set<String> METHODS = Set.of("CARD", "KBZPAY", "WAVE", "AYAPAY", "COD");
  private final PaySessionRepo sessions; private final OrderRepo orders; private final OrderService svc;
  PaymentController(PaySessionRepo s, OrderRepo o, OrderService svc) { sessions = s; orders = o; this.svc = svc; }
  private CustomerOrder own(Long id, Authentication a) {
    CustomerOrder o = orders.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "We couldn't find that order."));
    boolean staff = a.getAuthorities().stream().anyMatch(x -> !x.getAuthority().equals("ROLE_CUSTOMER"));
    if (!staff && !a.getName().equals(o.customer)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This order belongs to another account.");
    return o;
  }
  @PostMapping("/start") Map<String, Object> start(@RequestBody Start s, Authentication a) {
    if (s.method() == null || !METHODS.contains(s.method())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please choose a payment method.");
    CustomerOrder o = own(s.orderId(), a);
    if (o.status != CustomerOrder.Status.PENDING) throw new ResponseStatusException(HttpStatus.CONFLICT, "This order is already paid or closed.");
    if (s.method().equals("COD")) { svc.markPaid(o.id, "COD", "COD-" + o.id); return Map.of("status", "PAID", "orderId", o.id); }
    PaymentSession ps = new PaymentSession(); ps.id = UUID.randomUUID().toString(); ps.orderId = o.id; ps.method = s.method(); ps.amount = o.total; sessions.save(ps);
    return Map.of("sessionId", ps.id, "status", "PENDING", "method", ps.method, "amount", ps.amount, "orderId", o.id);
  }
  @PostMapping("/{id}/confirm") Map<String, Object> confirm(@PathVariable String id, @RequestBody Confirm c, Authentication a) {
    PaymentSession ps = sessions.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment session not found."));
    own(ps.orderId, a);
    if (!"PENDING".equals(ps.status)) throw new ResponseStatusException(HttpStatus.CONFLICT, "This payment was already processed. Please start a new payment.");
    if (c.approved()) { ps.ref = "SBX-" + ps.method + "-" + Long.toString(System.nanoTime(), 36).toUpperCase(); ps.status = "PAID"; sessions.save(ps); svc.markPaid(ps.orderId, ps.method, ps.ref); }
    else { ps.status = "FAILED"; sessions.save(ps); }
    return Map.of("status", ps.status, "ref", ps.ref == null ? "" : ps.ref, "orderId", ps.orderId);
  }
}
