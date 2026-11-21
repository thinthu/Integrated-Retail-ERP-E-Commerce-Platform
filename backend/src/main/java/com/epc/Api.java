package com.epc;
import jakarta.validation.Valid; import org.springframework.http.*; import org.springframework.security.core.Authentication; import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.MethodArgumentNotValidException; import org.springframework.web.bind.annotation.*; import org.springframework.web.multipart.*; import org.springframework.web.server.ResponseStatusException;
import java.io.IOException; import java.math.*; import java.nio.file.*; import java.time.*; import java.util.*; import java.util.stream.*;

@RestControllerAdvice class ApiErrors {
  private static ResponseEntity<Map<String, String>> r(HttpStatus s, String m) { return ResponseEntity.status(s).body(Map.of("message", m)); }
  @ExceptionHandler(MethodArgumentNotValidException.class) ResponseEntity<Map<String, String>> invalid(MethodArgumentNotValidException e) {
    return r(HttpStatus.BAD_REQUEST, "Please check the form: " + e.getBindingResult().getFieldErrors().stream().map(f -> f.getField() + " " + f.getDefaultMessage()).collect(Collectors.joining("; ")) + ".");
  }
  @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class) ResponseEntity<Map<String, String>> dup(Exception e) { return r(HttpStatus.CONFLICT, "That value already exists (for example a product with the same SKU). Please use a different one."); }
  @ExceptionHandler(MaxUploadSizeExceededException.class) ResponseEntity<Map<String, String>> big(Exception e) { return r(HttpStatus.PAYLOAD_TOO_LARGE, "That photo is too large. Please choose an image under 10 MB."); }
}

@RestController @RequestMapping("/api/products")
class ProductController {
  private final ProductRepo repo; private final AuditService audit; ProductController(ProductRepo r, AuditService a) { repo = r; audit = a; }
  @GetMapping List<Product> all() { return repo.findAll(); }
  @GetMapping("/low-stock") List<Product> low() { return repo.lowStock(); }
  @PostMapping Product create(@Valid @RequestBody Product p, Authentication a) { p.id = null; Product s = repo.save(p); audit.log(a.getName(), "PRODUCT_CREATE", "PRODUCT#" + s.id, s.name); return s; }
  @PutMapping("/{id}") Product update(@PathVariable Long id, @Valid @RequestBody Product p, Authentication a) {
    Product old = repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "That product no longer exists."));
    String d = old.name + (old.stock != p.stock ? " | stock " + old.stock + " -> " + p.stock : "") + (old.price.compareTo(p.price) != 0 ? " | price " + old.price + " -> " + p.price : "");
    p.id = id; if (p.cost == null) p.cost = old.cost; Product s = repo.save(p); audit.log(a.getName(), "PRODUCT_UPDATE", "PRODUCT#" + id, d); return s;
  }
  @DeleteMapping("/{id}") void delete(@PathVariable Long id, Authentication a) { String n = repo.findById(id).map(p -> p.name).orElse("?"); repo.deleteById(id); audit.log(a.getName(), "PRODUCT_DELETE", "PRODUCT#" + id, n); }
  @PostMapping("/{id}/image") Product image(@PathVariable Long id, @RequestParam("file") MultipartFile f, Authentication a) throws IOException {
    Product p = repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Save the product first, then upload its photo."));
    String ct = f.getContentType(); if (ct == null || !ct.startsWith("image/")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please choose an image file (JPG, PNG or WebP).");
    String ext = ct.equals("image/png") ? ".png" : ct.equals("image/webp") ? ".webp" : ".jpg"; Path dir = Path.of("uploads", "products"); Files.createDirectories(dir);
    String name = id + "-" + System.currentTimeMillis() + ext; f.transferTo(dir.resolve(name).toAbsolutePath()); p.imageUrl = "/uploads/products/" + name;
    audit.log(a.getName(), "PRODUCT_PHOTO", "PRODUCT#" + id, p.name); return repo.save(p);
  }
}

@RestController @RequestMapping("/api/master")
class MasterController {
  record In(String name, String extra) {}
  private static final Map<String, String> LABEL = Map.of("BRAND", "brand", "CATEGORY", "category", "COLOR", "color");
  private final MasterRepo repo; private final ProductRepo products; private final AuditService audit;
  MasterController(MasterRepo r, ProductRepo p, AuditService a) { repo = r; products = p; audit = a; }
  private static String type(String t) { String u = t.toUpperCase(); if (!LABEL.containsKey(u)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown list."); return u; }
  private static String clean(String t, String n) { if (n == null || n.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please enter a name."); n = n.trim(); return t.equals("COLOR") ? n.toLowerCase() : n; }
  private long used(String t, String name) {
    return products.findAll().stream().filter(p -> t.equals("BRAND") ? name.equalsIgnoreCase(p.brand) : t.equals("CATEGORY") ? name.equalsIgnoreCase(p.category) : p.colors != null && Arrays.asList(p.colors.split(",")).contains(name)).count();
  }
  @GetMapping("/{type}") List<MasterItem> list(@PathVariable String type) { return repo.findByTypeOrderByName(type(type)); }
  @PostMapping("/{type}") MasterItem add(@PathVariable String type, @RequestBody In in, Authentication a) {
    String t = type(type), n = clean(t, in.name());
    if (repo.existsByTypeAndNameIgnoreCase(t, n)) throw new ResponseStatusException(HttpStatus.CONFLICT, "A " + LABEL.get(t) + " named '" + n + "' already exists.");
    MasterItem i = new MasterItem(); i.type = t; i.name = n; i.extra = in.extra(); repo.save(i); audit.log(a.getName(), "CATALOG_ADD", t + "#" + i.id, n); return i;
  }
  @PutMapping("/{type}/{id}") MasterItem rename(@PathVariable String type, @PathVariable Long id, @RequestBody In in, Authentication a) {
    String t = type(type); MasterItem i = repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found."));
    final String old = i.name, n = clean(t, in.name());
    if (!n.equalsIgnoreCase(old) && repo.existsByTypeAndNameIgnoreCase(t, n)) throw new ResponseStatusException(HttpStatus.CONFLICT, "A " + LABEL.get(t) + " named '" + n + "' already exists.");
    for (Product p : products.findAll()) {
      boolean ch = false;
      if (t.equals("BRAND") && old.equalsIgnoreCase(p.brand)) { p.brand = n; ch = true; }
      else if (t.equals("CATEGORY") && old.equalsIgnoreCase(p.category)) { p.category = n; ch = true; }
      else if (t.equals("COLOR") && p.colors != null && Arrays.asList(p.colors.split(",")).contains(old)) { p.colors = Arrays.stream(p.colors.split(",")).map(c -> c.equals(old) ? n : c).collect(Collectors.joining(",")); ch = true; }
      if (ch) products.save(p);
    }
    i.name = n; i.extra = in.extra() != null ? in.extra() : i.extra; repo.save(i); audit.log(a.getName(), "CATALOG_EDIT", t + "#" + id, old + " -> " + n); return i;
  }
  @DeleteMapping("/{type}/{id}") void delete(@PathVariable String type, @PathVariable Long id, Authentication a) {
    String t = type(type); MasterItem i = repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found."));
    long u = used(t, i.name); if (u > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "Can't delete '" + i.name + "': " + u + " product(s) still use it. Change those products first.");
    repo.delete(i); audit.log(a.getName(), "CATALOG_DELETE", t + "#" + id, i.name);
  }
}

@RestController @RequestMapping("/api/orders")
class OrderController {
  record PayRequest(String method, BigDecimal amount) {}
  private final OrderService svc; private final OrderRepo repo; private final AuditRepo auditRepo;
  OrderController(OrderService s, OrderRepo r, AuditRepo ar) { svc = s; repo = r; auditRepo = ar; }
  @GetMapping List<CustomerOrder> recent() { return repo.findTop50ByOrderByCreatedAtDesc(); }
  @GetMapping("/mine") List<CustomerOrder> mine(Authentication a) { return repo.findByCustomerOrderByCreatedAtDesc(a.getName()); }
  @PostMapping CustomerOrder create(@RequestBody List<OrderService.Line> lines, Authentication a) { return svc.create(lines, a.getName()); }
  @PostMapping("/{id}/cancel") CustomerOrder cancel(@PathVariable Long id, Authentication a) {
    boolean customer = a.getAuthorities().stream().anyMatch(x -> x.getAuthority().equals("ROLE_CUSTOMER"));
    if (customer && repo.findById(id).map(o -> !a.getName().equals(o.customer)).orElse(true)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only cancel your own orders.");
    return svc.cancel(id, a.getName());
  }
  @PostMapping("/{id}/status") CustomerOrder status(@PathVariable Long id, @RequestParam CustomerOrder.Status to, Authentication a) { return svc.setStatus(id, to, a.getName()); }
  record Pos(List<OrderService.Line> lines, String method) {}
  @PostMapping("/pos") CustomerOrder pos(@RequestBody Pos p, Authentication a) { return svc.pos(p.lines(), p.method() == null ? "CASH" : p.method(), a.getName()); }
  @GetMapping("/{id}/history") List<AuditLog> history(@PathVariable Long id) { return auditRepo.findByTargetOrderByCreatedAtDesc("ORDER#" + id); }
}

@RestController @RequestMapping("/api/reports")
class ReportController {
  private static final Set<CustomerOrder.Status> REV = EnumSet.of(CustomerOrder.Status.PAID, CustomerOrder.Status.PROCESSING, CustomerOrder.Status.SHIPPED, CustomerOrder.Status.DELIVERED);
  private final OrderRepo orders; private final ProductRepo products; private final AuditRepo audit;
  ReportController(OrderRepo o, ProductRepo p, AuditRepo a) { orders = o; products = p; audit = a; }
  @GetMapping("/overview") Map<String, Object> overview() {
    var all = orders.findAll(); var pm = products.findAll().stream().collect(Collectors.toMap(p -> p.id, p -> p));
    ZoneId z = ZoneId.systemDefault(); LocalDate today = LocalDate.now();
    Map<LocalDate, BigDecimal> byDay = new TreeMap<>(); for (int i = 6; i >= 0; i--) byDay.put(today.minusDays(i), BigDecimal.ZERO);
    Map<String, Integer> status = new LinkedHashMap<>(); Map<String, BigDecimal> cat = new HashMap<>(); Map<String, Integer> top = new HashMap<>();
    BigDecimal total = BigDecimal.ZERO; int paid = 0; Set<String> custs = new HashSet<>();
    for (var o : all) {
      status.merge(o.status.name(), 1, Integer::sum);
      if (!REV.contains(o.status)) continue;
      total = total.add(o.total); paid++; if (o.customer != null) custs.add(o.customer);
      byDay.computeIfPresent(o.createdAt.atZone(z).toLocalDate(), (k, v) -> v.add(o.total));
      for (var i : o.items) { var p = pm.get(i.productId); String c = p == null ? "Other" : p.category;
        cat.merge(c, i.unitPrice.multiply(BigDecimal.valueOf(i.qty)), BigDecimal::add); top.merge(i.name, i.qty, Integer::sum); }
    }
    List<Object> topList = top.entrySet().stream().sorted((a, b) -> b.getValue() - a.getValue()).limit(6).map(e -> (Object) Map.of("name", e.getKey(), "qty", e.getValue())).toList();
    List<Object> daily = byDay.entrySet().stream().map(e -> (Object) Map.of("day", e.getKey().toString(), "revenue", e.getValue())).toList();
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("revenue", total); out.put("orders", all.size()); out.put("customers", custs.size());
    out.put("avgOrder", paid == 0 ? BigDecimal.ZERO : total.divide(BigDecimal.valueOf(paid), 2, RoundingMode.HALF_UP));
    out.put("lowStock", products.lowStock().size()); out.put("products", pm.size()); out.put("daily", daily); out.put("status", status); out.put("categories", cat); out.put("top", topList);
    return out;
  }

}

@RestController @RequestMapping("/api/support")
class SupportController {
  record Say(String text) {}
  private final MsgRepo repo; private final org.springframework.messaging.simp.SimpMessagingTemplate ws; private final NoticeService notices;
  SupportController(MsgRepo r, org.springframework.messaging.simp.SimpMessagingTemplate w, NoticeService n) { repo = r; ws = w; notices = n; }
  @GetMapping("/mine") List<SupportMessage> mine(Authentication a) { return repo.findByCustomerOrderByCreatedAtAsc(a.getName()); }
  @PostMapping("/mine") SupportMessage send(@RequestBody Say s, Authentication a) { return save(a.getName(), "CUSTOMER", s.text()); }
  @GetMapping("/admin/threads") List<String> threads() { return repo.customers(); }
  @GetMapping("/admin/thread/{c}") List<SupportMessage> thread(@PathVariable String c) { return repo.findByCustomerOrderByCreatedAtAsc(c); }
  @PostMapping("/admin/thread/{c}") SupportMessage reply(@PathVariable String c, @RequestBody Say s) { return save(c, "STAFF", s.text()); }
  private SupportMessage save(String c, String who, String t) {
    if (t == null || t.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please type a message first.");
    SupportMessage m = new SupportMessage(); m.customer = c; m.sender = who; m.body = t.trim(); repo.save(m); ws.convertAndSend("/topic/support", m);
    if (who.equals("CUSTOMER")) notices.send("STAFF", "New message from " + c, m.body, "inbox:" + c); else notices.send(c, "Reply from Khit Ride support", m.body, "chat");
    return m;
  }
}

@RestController @RequestMapping("/api/notices")
class NoticeController {
  private final NoticeRepo repo; NoticeController(NoticeRepo r) { repo = r; }
  private List<String> audiences(Authentication a) { List<String> l = new ArrayList<>(List.of(a.getName())); if (a.getAuthorities().stream().anyMatch(x -> !x.getAuthority().equals("ROLE_CUSTOMER"))) l.add("STAFF"); return l; }
  @GetMapping List<Notice> mine(Authentication a) { return repo.findTop30ByAudienceInOrderByCreatedAtDesc(audiences(a)); }
  @PostMapping("/read") void read(Authentication a) { var l = repo.findTop30ByAudienceInOrderByCreatedAtDesc(audiences(a)); l.forEach(n -> n.seen = true); repo.saveAll(l); }
}

@RestController @RequestMapping("/api/audit")
class AuditController { private final AuditRepo repo; AuditController(AuditRepo r) { repo = r; } @GetMapping List<AuditLog> all() { return repo.findTop300ByOrderByCreatedAtDesc(); } }

@RestController @RequestMapping("/api/users")
class UserController {
  record NewUser(String username, String password, String role) {}
  record RoleIn(String role) {}
  private static final Set<String> ROLES = Set.of("OWNER", "MANAGER", "STAFF");
  private final UserRepo users; private final PasswordEncoder enc; private final AuditService audit;
  UserController(UserRepo u, PasswordEncoder e, AuditService a) { users = u; enc = e; audit = a; }
  private static ResponseStatusException bad(HttpStatus s, String m) { return new ResponseStatusException(s, m); }
  @GetMapping List<Map<String, Object>> list() { return users.findAll().stream().map(u -> { Map<String, Object> m = new LinkedHashMap<>(); m.put("id", u.id); m.put("username", u.username); m.put("role", u.role); return m; }).toList(); }
  @GetMapping("/customers") List<String> customers() { return users.findAll().stream().filter(u -> "CUSTOMER".equals(u.role)).map(u -> u.username).sorted().toList(); }
  @PostMapping Map<String, Object> create(@RequestBody NewUser n, Authentication a) {
    if (n.username() == null || n.username().trim().length() < 3 || n.password() == null || n.password().length() < 6) throw bad(HttpStatus.BAD_REQUEST, "Username needs 3+ characters and password 6+ characters.");
    if (!ROLES.contains(n.role())) throw bad(HttpStatus.BAD_REQUEST, "Please choose a role: Owner, Manager or Staff.");
    if (users.findByUsername(n.username().trim()).isPresent()) throw bad(HttpStatus.CONFLICT, "That username is already taken.");
    AppUser u = new AppUser(); u.username = n.username().trim(); u.passwordHash = enc.encode(n.password()); u.role = n.role(); users.save(u);
    audit.log(a.getName(), "USER_CREATE", "USER#" + u.id, u.username + " as " + u.role); return Map.of("id", u.id, "username", u.username, "role", u.role);
  }
  @PutMapping("/{id}/role") Map<String, Object> role(@PathVariable Long id, @RequestBody RoleIn r, Authentication a) {
    AppUser u = users.findById(id).orElseThrow(() -> bad(HttpStatus.NOT_FOUND, "User not found."));
    if (u.username.equals(a.getName())) throw bad(HttpStatus.BAD_REQUEST, "You can't change your own role.");
    if (!ROLES.contains(r.role())) throw bad(HttpStatus.BAD_REQUEST, "Invalid role."); String old = u.role; u.role = r.role(); users.save(u);
    audit.log(a.getName(), "USER_ROLE", "USER#" + id, u.username + ": " + old + " -> " + u.role); return Map.of("id", u.id, "username", u.username, "role", u.role);
  }
  @DeleteMapping("/{id}") void delete(@PathVariable Long id, Authentication a) {
    AppUser u = users.findById(id).orElseThrow(() -> bad(HttpStatus.NOT_FOUND, "User not found."));
    if (u.username.equals(a.getName())) throw bad(HttpStatus.BAD_REQUEST, "You can't delete your own account.");
    users.delete(u); audit.log(a.getName(), "USER_DELETE", "USER#" + id, u.username);
  }
}
