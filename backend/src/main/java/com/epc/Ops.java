package com.epc;
import org.springframework.http.HttpStatus; import org.springframework.security.core.Authentication; import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*; import org.springframework.web.server.ResponseStatusException;
import java.math.*; import java.time.*; import java.util.*; import java.util.stream.*;

@RestController @RequestMapping("/api/suppliers")
class SupplierController {
  private final SupplierRepo repo; private final ProductRepo products; private final PoRepo pos; private final AuditService audit;
  SupplierController(SupplierRepo r, ProductRepo p, PoRepo po, AuditService a) { repo = r; products = p; pos = po; audit = a; }
  private static ResponseStatusException bad(HttpStatus s, String m) { return new ResponseStatusException(s, m); }
  private static void check(Supplier s) { if (s.name == null || s.name.isBlank()) throw bad(HttpStatus.BAD_REQUEST, "Please enter the supplier's name."); s.name = s.name.trim(); }
  @GetMapping List<Supplier> all() { return repo.findAll(); }
  @PostMapping Supplier add(@RequestBody Supplier s, Authentication a) { check(s); s.id = null; repo.save(s); audit.log(a.getName(), "SUPPLIER_ADD", "SUPPLIER#" + s.id, s.name); return s; }
  @PutMapping("/{id}") Supplier edit(@PathVariable Long id, @RequestBody Supplier s, Authentication a) {
    check(s); repo.findById(id).orElseThrow(() -> bad(HttpStatus.NOT_FOUND, "Supplier not found.")); s.id = id; repo.save(s); audit.log(a.getName(), "SUPPLIER_EDIT", "SUPPLIER#" + id, s.name); return s;
  }
  @DeleteMapping("/{id}") void del(@PathVariable Long id, Authentication a) {
    Supplier s = repo.findById(id).orElseThrow(() -> bad(HttpStatus.NOT_FOUND, "Supplier not found."));
    long n = products.findAll().stream().filter(p -> id.equals(p.supplierId)).count() + pos.findAll().stream().filter(p -> id.equals(p.supplierId)).count();
    if (n > 0) throw bad(HttpStatus.CONFLICT, "Can't delete '" + s.name + "': it is still linked to " + n + " product(s) or purchase order(s).");
    repo.delete(s); audit.log(a.getName(), "SUPPLIER_DELETE", "SUPPLIER#" + id, s.name);
  }
}

@RestController @RequestMapping("/api/purchase-orders")
class PoController {
  record LineIn(Long productId, int qty, BigDecimal unitCost) {}
  record PoIn(Long supplierId, List<LineIn> lines, boolean ordered) {}
  private final PoRepo repo; private final SupplierRepo suppliers; private final ProductRepo products; private final AuditService audit;
  PoController(PoRepo r, SupplierRepo s, ProductRepo p, AuditService a) { repo = r; suppliers = s; products = p; audit = a; }
  private static ResponseStatusException bad(HttpStatus s, String m) { return new ResponseStatusException(s, m); }
  private PurchaseOrder get(Long id) { return repo.findById(id).orElseThrow(() -> bad(HttpStatus.NOT_FOUND, "Purchase order not found.")); }
  @GetMapping List<PurchaseOrder> all() { return repo.findAllByOrderByCreatedAtDesc(); }
  @PostMapping @Transactional public PurchaseOrder create(@RequestBody PoIn in, Authentication a) {
    if (in.supplierId() == null) throw bad(HttpStatus.BAD_REQUEST, "Please choose a supplier.");
    Supplier s = suppliers.findById(in.supplierId()).orElseThrow(() -> bad(HttpStatus.BAD_REQUEST, "That supplier no longer exists."));
    if (in.lines() == null || in.lines().isEmpty()) throw bad(HttpStatus.BAD_REQUEST, "Add at least one item to the purchase order.");
    PurchaseOrder po = new PurchaseOrder(); po.supplierId = s.id; po.supplierName = s.name; po.createdBy = a.getName(); po.status = in.ordered() ? "ORDERED" : "DRAFT";
    for (LineIn l : in.lines()) {
      if (l.productId() == null || l.qty() <= 0 || l.unitCost() == null || l.unitCost().signum() < 0) throw bad(HttpStatus.BAD_REQUEST, "Each line needs a product, a quantity above 0 and a unit cost.");
      Product p = products.findById(l.productId()).orElseThrow(() -> bad(HttpStatus.NOT_FOUND, "A product in the list no longer exists."));
      PoLine pl = new PoLine(); pl.productId = p.id; pl.name = p.name; pl.qty = l.qty(); pl.unitCost = l.unitCost(); po.lines.add(pl); po.total = po.total.add(l.unitCost().multiply(BigDecimal.valueOf(l.qty())));
    }
    repo.save(po); audit.log(a.getName(), "PO_CREATE", "PO#" + po.id, s.name + " $" + po.total); return po;
  }
  @PostMapping("/{id}/order") PurchaseOrder order(@PathVariable Long id, Authentication a) {
    PurchaseOrder po = get(id); if (!"DRAFT".equals(po.status)) throw bad(HttpStatus.CONFLICT, "Only a draft can be sent to the supplier.");
    po.status = "ORDERED"; repo.save(po); audit.log(a.getName(), "PO_ORDERED", "PO#" + id, po.supplierName); return po;
  }
  @PostMapping("/{id}/receive") @Transactional public PurchaseOrder receive(@PathVariable Long id, Authentication a) {
    PurchaseOrder po = get(id); if (!"ORDERED".equals(po.status)) throw bad(HttpStatus.CONFLICT, "Only an ordered purchase order can be received.");
    for (PoLine l : po.lines) {
      Product p = products.findById(l.productId).orElse(null); if (p == null) continue;
      BigDecimal value = FinanceService.prodCost(p).multiply(BigDecimal.valueOf(p.stock)).add(l.unitCost.multiply(BigDecimal.valueOf(l.qty))); int ns = p.stock + l.qty;
      p.cost = value.divide(BigDecimal.valueOf(ns), 2, RoundingMode.HALF_UP); p.stock = ns; products.save(p); // weighted-average cost
    }
    po.status = "RECEIVED"; po.receivedBy = a.getName(); po.receivedAt = Instant.now(); repo.save(po); audit.log(a.getName(), "PO_RECEIVED", "PO#" + id, po.supplierName + ": stock updated"); return po;
  }
  @PostMapping("/{id}/pay") PurchaseOrder pay(@PathVariable Long id, Authentication a) {
    PurchaseOrder po = get(id); if (!"ORDERED".equals(po.status) && !"RECEIVED".equals(po.status)) throw bad(HttpStatus.CONFLICT, "Only ordered or received purchase orders can be paid.");
    if (po.paid) throw bad(HttpStatus.CONFLICT, "This purchase order is already paid."); po.paid = true; po.paidAt = Instant.now(); repo.save(po); audit.log(a.getName(), "PO_PAID", "PO#" + id, "$" + po.total); return po;
  }
  @PostMapping("/{id}/cancel") PurchaseOrder cancel(@PathVariable Long id, Authentication a) {
    PurchaseOrder po = get(id); if (po.paid || "RECEIVED".equals(po.status) || "CANCELLED".equals(po.status)) throw bad(HttpStatus.CONFLICT, "This purchase order can't be cancelled any more.");
    po.status = "CANCELLED"; repo.save(po); audit.log(a.getName(), "PO_CANCELLED", "PO#" + id, po.supplierName); return po;
  }
}

@RestController @RequestMapping("/api/expenses")
class ExpenseController {
  record In(String category, BigDecimal amount, String note, String date) {}
  private final ExpenseRepo repo; private final AuditService audit; ExpenseController(ExpenseRepo r, AuditService a) { repo = r; audit = a; }
  @GetMapping List<Expense> all() { return repo.findAllByOrderBySpentAtDesc(); }
  @PostMapping Expense add(@RequestBody In in, Authentication a) {
    if (in.category() == null || in.category().isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please choose a category.");
    if (in.amount() == null || in.amount().signum() <= 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter an amount above 0.");
    Expense e = new Expense(); e.category = in.category().trim(); e.amount = in.amount(); e.note = in.note(); e.createdBy = a.getName();
    if (in.date() != null && !in.date().isBlank()) { try { e.spentAt = LocalDate.parse(in.date()).atStartOfDay(ZoneId.systemDefault()).toInstant(); } catch (Exception x) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That date isn't valid. Please use the date picker."); } }
    repo.save(e); audit.log(a.getName(), "EXPENSE_ADD", "EXPENSE#" + e.id, e.category + " $" + e.amount); return e;
  }
  @DeleteMapping("/{id}") void del(@PathVariable Long id, Authentication a) { repo.deleteById(id); audit.log(a.getName(), "EXPENSE_DELETE", "EXPENSE#" + id, null); }
}

@org.springframework.stereotype.Service
class FinanceService {
  static final Set<CustomerOrder.Status> REV = EnumSet.of(CustomerOrder.Status.PAID, CustomerOrder.Status.PROCESSING, CustomerOrder.Status.SHIPPED, CustomerOrder.Status.DELIVERED);
  private static final BigDecimal DEF = new BigDecimal("0.62"), HUNDRED = BigDecimal.valueOf(100);
  private final OrderRepo orders; private final ProductRepo products; private final PoRepo pos; private final ExpenseRepo expenses; private final SettingRepo settings; private final SupplierRepo suppliers;
  FinanceService(OrderRepo o, ProductRepo p, PoRepo po, ExpenseRepo e, SettingRepo s, SupplierRepo su) { orders = o; products = p; pos = po; expenses = e; settings = s; suppliers = su; }
  static BigDecimal r2(BigDecimal x) { return x.setScale(2, RoundingMode.HALF_UP); }
  static BigDecimal prodCost(Product p) { return p.cost != null ? p.cost : p.price.multiply(DEF); }
  static BigDecimal itemCost(OrderItem i, Product p) { return i.unitCost != null ? i.unitCost : p != null ? prodCost(p) : i.unitPrice.multiply(DEF); }
  static int pct(Product p) { return p.salePercent == null ? 0 : p.salePercent; }
  static double pctOf(BigDecimal part, BigDecimal whole) { return whole.signum() == 0 ? 0 : part.multiply(HUNDRED).divide(whole, 1, RoundingMode.HALF_UP).doubleValue(); }
  BigDecimal capital() { return settings.findById("capital").map(s -> new BigDecimal(s.val)).orElse(new BigDecimal("50000")); }
  void setCapital(BigDecimal v) { Setting s = new Setting(); s.name = "capital"; s.val = v.toPlainString(); settings.save(s); }
  private Map<Long, Product> pmap() { return products.findAll().stream().collect(Collectors.toMap(p -> p.id, p -> p)); }

  Map<String, Object> statements() {
    var pm = pmap(); BigDecimal gross = BigDecimal.ZERO, net = BigDecimal.ZERO, cogs = BigDecimal.ZERO;
    for (var o : orders.findAll()) { if (!REV.contains(o.status)) continue; net = net.add(o.total);
      for (var i : o.items) { BigDecimal q = BigDecimal.valueOf(i.qty); cogs = cogs.add(itemCost(i, pm.get(i.productId)).multiply(q)); gross = gross.add((i.listPrice != null ? i.listPrice : i.unitPrice).multiply(q)); } }
    Map<String, BigDecimal> expBy = new TreeMap<>(); BigDecimal exp = BigDecimal.ZERO;
    for (var e : expenses.findAll()) { expBy.merge(e.category, e.amount, BigDecimal::add); exp = exp.add(e.amount); }
    BigDecimal gp = net.subtract(cogs), ni = gp.subtract(exp), paidPo = BigDecimal.ZERO, ap = BigDecimal.ZERO, prepaid = BigDecimal.ZERO, inv = BigDecimal.ZERO;
    for (var po : pos.findAll()) { if ("CANCELLED".equals(po.status)) continue; if (po.paid) paidPo = paidPo.add(po.total); if ("RECEIVED".equals(po.status) && !po.paid) ap = ap.add(po.total); if ("ORDERED".equals(po.status) && po.paid) prepaid = prepaid.add(po.total); }
    for (var p : pm.values()) inv = inv.add(prodCost(p).multiply(BigDecimal.valueOf(p.stock)));
    BigDecimal capital = capital(), cash = capital.add(net).subtract(paidPo).subtract(exp), assets = cash.add(inv).add(prepaid), equity = assets.subtract(ap), adj = equity.subtract(capital).subtract(ni);
    Map<String, Object> inc = new LinkedHashMap<>();
    inc.put("grossSales", r2(gross)); inc.put("discounts", r2(gross.subtract(net))); inc.put("netRevenue", r2(net)); inc.put("cogs", r2(cogs)); inc.put("grossProfit", r2(gp)); inc.put("grossMarginPct", pctOf(gp, net));
    Map<String, BigDecimal> eb = new LinkedHashMap<>(); expBy.forEach((k, v) -> eb.put(k, r2(v))); inc.put("expenses", eb); inc.put("totalExpenses", r2(exp)); inc.put("netIncome", r2(ni)); inc.put("netMarginPct", pctOf(ni, net));
    Map<String, Object> bal = new LinkedHashMap<>();
    bal.put("cash", r2(cash)); bal.put("inventory", r2(inv)); bal.put("prepaid", r2(prepaid)); bal.put("totalAssets", r2(assets)); bal.put("payables", r2(ap)); bal.put("totalLiabilities", r2(ap));
    bal.put("ownerCapital", r2(capital)); bal.put("retainedEarnings", r2(ni)); bal.put("adjustments", r2(adj)); bal.put("totalEquity", r2(equity)); bal.put("totalLiabilitiesAndEquity", r2(ap.add(equity)));
    Map<String, Object> out = new LinkedHashMap<>(); out.put("income", inc); out.put("balance", bal); return out;
  }

  List<Map<String, Object>> items() {
    var pm = pmap(); var sm = suppliers.findAll().stream().collect(Collectors.toMap(s -> s.id, s -> s));
    Map<Long, Integer> units = new HashMap<>(); Map<Long, BigDecimal> rev = new HashMap<>(), prof = new HashMap<>();
    for (var o : orders.findAll()) { if (!REV.contains(o.status)) continue;
      for (var i : o.items) { BigDecimal q = BigDecimal.valueOf(i.qty); units.merge(i.productId, i.qty, Integer::sum); rev.merge(i.productId, i.unitPrice.multiply(q), BigDecimal::add); prof.merge(i.productId, i.unitPrice.subtract(itemCost(i, pm.get(i.productId))).multiply(q), BigDecimal::add); } }
    List<Map<String, Object>> out = new ArrayList<>();
    for (var p : pm.values()) {
      BigDecimal eff = Pricing.effective(p.price, pct(p)), cost = prodCost(p); Map<String, Object> r = new LinkedHashMap<>();
      r.put("id", p.id); r.put("sku", p.sku); r.put("name", p.name); r.put("category", p.category); r.put("supplierId", p.supplierId); r.put("supplier", p.supplierId == null || !sm.containsKey(p.supplierId) ? "-" : sm.get(p.supplierId).name);
      r.put("price", p.price); r.put("effective", eff); r.put("salePercent", pct(p)); r.put("cost", r2(cost)); r.put("marginPct", pctOf(eff.subtract(cost), eff)); r.put("profitable", eff.compareTo(cost) > 0);
      r.put("stock", p.stock); r.put("stockValue", r2(cost.multiply(BigDecimal.valueOf(p.stock)))); r.put("unitsSold", units.getOrDefault(p.id, 0)); r.put("revenue", r2(rev.getOrDefault(p.id, BigDecimal.ZERO))); r.put("profit", r2(prof.getOrDefault(p.id, BigDecimal.ZERO))); out.add(r);
    }
    out.sort((a, b) -> ((BigDecimal) b.get("profit")).compareTo((BigDecimal) a.get("profit"))); return out;
  }

  List<Map<String, Object>> bySupplier() {
    Map<Long, Map<String, Object>> g = new LinkedHashMap<>();
    for (var s : suppliers.findAll()) { Map<String, Object> r = new LinkedHashMap<>(); r.put("id", s.id); r.put("name", s.name); r.put("products", 0); r.put("inventoryValue", BigDecimal.ZERO); r.put("unitsSold", 0); r.put("revenue", BigDecimal.ZERO); r.put("profit", BigDecimal.ZERO); r.put("purchased", BigDecimal.ZERO); g.put(s.id, r); }
    for (var it : items()) { Map<String, Object> r = g.get((Long) it.get("supplierId")); if (r == null) continue;
      r.put("products", (Integer) r.get("products") + 1); r.put("inventoryValue", ((BigDecimal) r.get("inventoryValue")).add((BigDecimal) it.get("stockValue"))); r.put("unitsSold", (Integer) r.get("unitsSold") + (Integer) it.get("unitsSold"));
      r.put("revenue", ((BigDecimal) r.get("revenue")).add((BigDecimal) it.get("revenue"))); r.put("profit", ((BigDecimal) r.get("profit")).add((BigDecimal) it.get("profit"))); }
    for (var po : pos.findAll()) { if (!"RECEIVED".equals(po.status)) continue; Map<String, Object> r = g.get(po.supplierId); if (r != null) r.put("purchased", ((BigDecimal) r.get("purchased")).add(po.total)); }
    return new ArrayList<>(g.values());
  }

  List<Map<String, Object>> monthly() {
    var pm = pmap(); ZoneId z = ZoneId.systemDefault(); YearMonth now = YearMonth.now(z); Map<YearMonth, BigDecimal[]> m = new LinkedHashMap<>();
    for (int k = 5; k >= 0; k--) m.put(now.minusMonths(k), new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO});
    for (var o : orders.findAll()) { if (!REV.contains(o.status)) continue; BigDecimal[] a = m.get(YearMonth.from(o.createdAt.atZone(z))); if (a == null) continue; a[0] = a[0].add(o.total);
      for (var i : o.items) a[1] = a[1].add(itemCost(i, pm.get(i.productId)).multiply(BigDecimal.valueOf(i.qty))); }
    for (var e : expenses.findAll()) { BigDecimal[] a = m.get(YearMonth.from(e.spentAt.atZone(z))); if (a != null) a[2] = a[2].add(e.amount); }
    List<Map<String, Object>> out = new ArrayList<>();
    m.forEach((k, a) -> { Map<String, Object> r = new LinkedHashMap<>(); r.put("month", k.toString()); r.put("revenue", r2(a[0])); r.put("cogs", r2(a[1])); r.put("expenses", r2(a[2])); r.put("profit", r2(a[0].subtract(a[1]).subtract(a[2]))); out.add(r); });
    return out;
  }

  List<Map<String, Object>> plan(double minMargin) {
    List<Map<String, Object>> out = new ArrayList<>();
    for (var p : products.findAll()) {
      BigDecimal cost = prodCost(p); Map<String, Object> r = new LinkedHashMap<>();
      r.put("id", p.id); r.put("name", p.name); r.put("category", p.category); r.put("brand", p.brand); r.put("price", p.price); r.put("cost", r2(cost)); r.put("marginPct", pctOf(p.price.subtract(cost), p.price));
      r.put("breakEvenPct", Pricing.breakEvenPercent(p.price, cost)); r.put("maxSafePct", Pricing.maxSafePercent(p.price, cost, minMargin)); r.put("salePercent", pct(p)); r.put("stock", p.stock); out.add(r);
    }
    return out;
  }
}

@RestController @RequestMapping("/api/finance")
class FinanceController {
  record Cap(BigDecimal amount) {}
  private final FinanceService svc; private final AuditService audit; FinanceController(FinanceService s, AuditService a) { svc = s; audit = a; }
  @GetMapping("/statements") Map<String, Object> statements() { return svc.statements(); }
  @GetMapping("/items") List<Map<String, Object>> items() { return svc.items(); }
  @GetMapping("/suppliers") List<Map<String, Object>> suppliers() { return svc.bySupplier(); }
  @GetMapping("/monthly") List<Map<String, Object>> monthly() { return svc.monthly(); }
  @GetMapping("/discount-plan") List<Map<String, Object>> plan(@RequestParam(defaultValue = "10") double minMargin) { return svc.plan(minMargin); }
  @PutMapping("/capital") Map<String, Object> capital(@RequestBody Cap c, Authentication a) {
    if (c.amount() == null || c.amount().signum() < 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter the owner's capital as a number (0 or more).");
    svc.setCapital(c.amount()); audit.log(a.getName(), "CAPITAL_SET", "SETTINGS", "$" + c.amount()); return Map.of("capital", c.amount());
  }
}

@RestController @RequestMapping("/api/promotions")
class PromotionController {
  record Apply(String scope, List<Long> ids, String category, int percent, Double minMargin, boolean force) {}
  private final ProductRepo products; private final AuditService audit; PromotionController(ProductRepo p, AuditService a) { products = p; audit = a; }
  private List<Product> targets(Apply in) {
    List<Product> all = products.findAll(); String s = in.scope() == null ? "" : in.scope();
    if (s.equals("IDS")) { Set<Long> ids = in.ids() == null ? Set.of() : new HashSet<>(in.ids()); return all.stream().filter(p -> ids.contains(p.id)).toList(); }
    if (s.equals("CATEGORY")) return all.stream().filter(p -> p.category != null && p.category.equalsIgnoreCase(in.category())).toList();
    if (s.equals("ALL")) return all;
    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose which items the discount applies to.");
  }
  @PostMapping("/apply") Map<String, Object> apply(@RequestBody Apply in, Authentication a) {
    if (in.percent() < 1 || in.percent() > 90) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The discount must be between 1% and 90%.");
    List<Product> ts = targets(in); if (ts.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No items matched your selection.");
    double mm = in.minMargin() == null ? 10 : in.minMargin(); int applied = 0; List<Object> skipped = new ArrayList<>();
    for (Product p : ts) {
      BigDecimal cost = FinanceService.prodCost(p); int safe = Pricing.maxSafePercent(p.price, cost, mm), be = Pricing.breakEvenPercent(p.price, cost);
      if (in.percent() <= safe || (in.force() && in.percent() <= be)) { p.salePercent = in.percent(); products.save(p); applied++; }
      else skipped.add(Map.of("id", p.id, "name", p.name, "maxSafe", safe, "breakEven", be));
    }
    audit.log(a.getName(), "PROMOTION_APPLY", "PRODUCTS", in.percent() + "% on " + applied + " item(s), " + skipped.size() + " skipped");
    return Map.of("applied", applied, "skipped", skipped);
  }
  @PostMapping("/clear") Map<String, Object> clear(@RequestBody Apply in, Authentication a) {
    int n = 0; for (Product p : targets(in)) if (p.salePercent != null && p.salePercent > 0) { p.salePercent = 0; products.save(p); n++; }
    audit.log(a.getName(), "PROMOTION_CLEAR", "PRODUCTS", n + " item(s)"); return Map.of("cleared", n);
  }
}

@RestController @RequestMapping("/api/broadcasts")
class BroadcastController {
  record In(String title, String body, String link, String audience, List<String> users) {}
  private final UserRepo users; private final NoticeService notices; private final BroadcastRepo repo; private final AuditService audit;
  BroadcastController(UserRepo u, NoticeService n, BroadcastRepo r, AuditService a) { users = u; notices = n; repo = r; audit = a; }
  @GetMapping List<Broadcast> history() { return repo.findTop30ByOrderByCreatedAtDesc(); }
  @PostMapping Broadcast send(@RequestBody In in, Authentication a) {
    if (in.title() == null || in.title().isBlank() || in.body() == null || in.body().isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please add a title and a message.");
    boolean some = "USERS".equals(in.audience()); Set<String> want = in.users() == null ? Set.of() : new HashSet<>(in.users());
    List<String> to = users.findAll().stream().filter(u -> "CUSTOMER".equals(u.role) && (!some || want.contains(u.username))).map(u -> u.username).toList();
    if (to.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, some ? "Choose at least one customer." : "There are no customer accounts to notify yet.");
    String link = in.link() == null || in.link().isBlank() ? null : in.link();
    for (String u : to) notices.send(u, in.title().trim(), in.body().trim(), link);
    Broadcast b = new Broadcast(); b.title = in.title().trim(); b.body = in.body().trim(); b.link = link; b.audience = some ? to.size() + " selected customer(s)" : "All customers"; b.recipients = to.size(); b.sentBy = a.getName(); repo.save(b);
    audit.log(a.getName(), "BROADCAST", "BROADCAST#" + b.id, b.title + " -> " + b.audience); return b;
  }
}
