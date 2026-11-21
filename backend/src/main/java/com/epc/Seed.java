package com.epc;
import org.springframework.boot.CommandLineRunner; import org.springframework.core.annotation.Order; import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder; import org.springframework.stereotype.Component;
import java.math.BigDecimal; import java.time.*; import java.util.*;

/** Repairs databases created by older versions (order status used to be a restricted enum column). */
@Component @Order(1) class SchemaFix implements CommandLineRunner {
  private final JdbcTemplate jdbc; SchemaFix(JdbcTemplate j) { jdbc = j; }
  public void run(String... args) {
    try { for (String c : jdbc.queryForList("select constraint_name from information_schema.table_constraints where upper(table_name)='ORDERS' and constraint_type='CHECK'", String.class)) { try { jdbc.execute("alter table orders drop constraint \"" + c + "\""); } catch (Exception ignored) { } } } catch (Exception ignored) { }
    for (String sql : new String[]{"alter table orders alter column status set data type varchar(20)", "alter table orders alter column status type varchar(20)"}) { try { jdbc.execute(sql); break; } catch (Exception ignored) { } }
  }
}

@Component @Order(2) class DataSeeder implements CommandLineRunner {
  private final UserRepo users; private final ProductRepo products; private final OrderRepo orders; private final PaymentRepo payments; private final MsgRepo msgs; private final MasterRepo master;
  private final SupplierRepo suppliers; private final PoRepo pos; private final ExpenseRepo expenses; private final PasswordEncoder enc;
  DataSeeder(UserRepo u, ProductRepo p, OrderRepo o, PaymentRepo pay, MsgRepo m, MasterRepo ms, SupplierRepo su, PoRepo po, ExpenseRepo ex, PasswordEncoder e) { users = u; products = p; orders = o; payments = pay; msgs = m; master = ms; suppliers = su; pos = po; expenses = ex; enc = e; }
  private void user(String n, String pw, String role) { if (users.findByUsername(n).isPresent()) return; AppUser a = new AppUser(); a.username = n; a.passwordHash = enc.encode(pw); a.role = role; users.save(a); }
  private void m(String t, String n, String x) { MasterItem i = new MasterItem(); i.type = t; i.name = n; i.extra = x; master.save(i); }

  public void run(String... args) {
    users.findByUsername("admin").ifPresent(users::delete); users.findByUsername("cashier").ifPresent(users::delete);
    user("owner", "owner123", "OWNER"); user("manager", "manager123", "MANAGER"); user("staff", "staff123", "STAFF"); user("customer", "customer123", "CUSTOMER");
    if (master.count() == 0) {
      for (String b : new String[]{"Khit", "Ayeyar", "Bagan", "Yoma", "Inle", "Irra", "Thanlwin", "Kandawgyi"}) m("BRAND", b, null);
      for (String c : new String[]{"Road", "Mountain", "Electric", "City", "Kids", "BMX", "Folding", "Gravel", "Accessories"}) m("CATEGORY", c, null);
      for (String[] c : new String[][]{{"red", "#ef4444"}, {"blue", "#3b82f6"}, {"black", "#1f2937"}, {"green", "#22c55e"}, {"orange", "#f97316"}, {"white", "#e5e7eb"}, {"yellow", "#eab308"}, {"teal", "#14b8a6"}}) m("COLOR", c[0], c[1]);
    }
    Random rnd = new Random(42);
    if (products.findAll().stream().noneMatch(p -> p.brand != null)) { payments.deleteAll(); orders.deleteAll(); products.deleteAll(); catalog(rnd); }
    if (suppliers.count() == 0) for (String[] s : new String[][]{{"Taiwan Cycle Parts Co.", "Ms. Lin", "+886 4 2234 5678", "sales@tcparts.example", "Taiwan"}, {"Yangon Bike Wholesale", "U Kyaw", "+95 1 555 010", "kyaw@ybw.example", "Myanmar"},
      {"Nippon Gear Imports", "Mr. Sato", "+81 6 1234 5678", "sato@nippongear.example", "Japan"}, {"Shenzhen E-Mobility Ltd", "Mr. Chen", "+86 755 8888 0000", "chen@semobility.example", "China"}}) {
      Supplier x = new Supplier(); x.name = s[0]; x.contact = s[1]; x.phone = s[2]; x.email = s[3]; x.country = s[4]; suppliers.save(x); }
    List<Supplier> sup = suppliers.findAll();
    Map<String, Integer> sIdx = Map.of("Road", 0, "Gravel", 0, "Mountain", 1, "BMX", 1, "City", 1, "Kids", 1, "Folding", 1, "Accessories", 2, "Electric", 3);
    int k = 0;
    for (Product p : products.findAll()) { boolean ch = false;
      if (p.cost == null) { p.cost = p.price.multiply(new BigDecimal("0.62")).setScale(2, java.math.RoundingMode.HALF_UP); ch = true; }
      if (p.supplierId == null) { p.supplierId = sup.get(sIdx.getOrDefault(p.category, 1) % sup.size()).id; ch = true; }
      if (p.salePercent == null) { p.salePercent = 0; ch = true; }
      if (ch) products.save(p); }
    if (products.findAll().stream().noneMatch(p -> p.salePercent > 0)) for (Product p : products.findAll()) if ((k++) % 17 == 3) { p.salePercent = 10 + (k % 4) * 5; products.save(p); }
    List<Product> ps = products.findAll();
    if (pos.count() == 0) for (int i = 0; i < 6; i++) {
      Supplier s = sup.get(i % sup.size()); PurchaseOrder po = new PurchaseOrder(); po.supplierId = s.id; po.supplierName = s.name; po.createdBy = "manager"; po.createdAt = Instant.now().minus(Duration.ofDays(150 - i * 25L));
      for (Product p : ps.stream().filter(x -> s.id.equals(x.supplierId)).limit(4).toList()) { PoLine l = new PoLine(); l.productId = p.id; l.name = p.name; l.qty = 5 + rnd.nextInt(10); l.unitCost = p.cost; po.lines.add(l); po.total = po.total.add(p.cost.multiply(BigDecimal.valueOf(l.qty))); }
      po.status = i < 4 ? "RECEIVED" : i == 4 ? "ORDERED" : "DRAFT"; po.paid = i < 3;
      if (i < 4) { po.receivedAt = po.createdAt.plus(Duration.ofDays(3)); po.receivedBy = "staff"; } if (po.paid) po.paidAt = po.createdAt.plus(Duration.ofDays(5)); pos.save(po);
    }
    if (expenses.count() == 0) for (int mo = 0; mo < 6; mo++) for (String[] e : new String[][]{{"Rent", "1200"}, {"Salaries", "2400"}, {"Utilities", "180"}, {"Marketing", "300"}}) {
      Expense x = new Expense(); x.category = e[0]; x.amount = new BigDecimal(e[1]).add(BigDecimal.valueOf(rnd.nextInt(40))); x.createdBy = "owner"; x.note = e[0] + " - monthly"; x.spentAt = Instant.now().minus(Duration.ofDays(mo * 30L + 2)); expenses.save(x); }
    if (orders.findAll().stream().noneMatch(o -> o.customer != null && o.customer.startsWith("buyer"))) demoOrders(ps, rnd);
    if (msgs.count() == 0) { SupportMessage s = new SupportMessage(); s.customer = "customer"; s.sender = "STAFF"; s.body = "Welcome to Khit Ride! Ask us anything about our bikes."; msgs.save(s); }
  }

  private void demoOrders(List<Product> ps, Random rnd) {
    String[] pm = {"KBZPAY", "CARD", "WAVE", "COD"};
    for (int i = 0; i < 220; i++) {
      CustomerOrder o = new CustomerOrder();
      for (int j = 0, n = 1 + rnd.nextInt(3); j < n; j++) {
        Product p = ps.get(rnd.nextInt(ps.size())); OrderItem it = new OrderItem(); it.productId = p.id; it.name = p.name; it.qty = 1 + rnd.nextInt(2); it.listPrice = p.price; it.unitPrice = Pricing.effective(p.price, p.salePercent == null ? 0 : p.salePercent); it.unitCost = p.cost;
        BigDecimal q = BigDecimal.valueOf(it.qty); o.items.add(it); o.total = o.total.add(it.unitPrice.multiply(q)); o.discount = o.discount.add(p.price.subtract(it.unitPrice).multiply(q));
      }
      o.createdAt = Instant.now().minus(Duration.ofMinutes(rnd.nextInt(60 * 24 * (rnd.nextInt(10) < 5 ? 14 : 170)))); o.customer = i % 4 == 0 ? "customer" : "buyer" + (1 + rnd.nextInt(25));
      int r = rnd.nextInt(100); o.status = r < 6 ? CustomerOrder.Status.CANCELLED : r < 12 ? CustomerOrder.Status.PENDING : r < 22 ? CustomerOrder.Status.PAID : r < 38 ? CustomerOrder.Status.PROCESSING : r < 58 ? CustomerOrder.Status.SHIPPED : CustomerOrder.Status.DELIVERED;
      boolean paid = o.status != CustomerOrder.Status.CANCELLED && o.status != CustomerOrder.Status.PENDING;
      if (paid) { o.paymentMethod = pm[rnd.nextInt(pm.length)]; o.paymentRef = "DEMO-" + (1000 + i); }
      if (o.status == CustomerOrder.Status.PROCESSING || o.status == CustomerOrder.Status.SHIPPED || o.status == CustomerOrder.Status.DELIVERED) { o.updatedBy = i % 2 == 0 ? "staff" : "manager"; o.updatedAt = o.createdAt.plus(Duration.ofHours(3)); }
      orders.save(o);
      if (paid) { Payment pay = new Payment(); pay.orderId = o.id; pay.method = o.paymentMethod; pay.amount = o.total; pay.paidAt = o.createdAt; payments.save(pay); }
    }
  }

  private void catalog(Random rnd) {
    String[] brands = {"Khit", "Ayeyar", "Bagan", "Yoma", "Inle", "Irra", "Thanlwin", "Kandawgyi"};
    String[] series = {"Falcon", "Comet", "Rapid", "Nova", "Pulse", "Summit", "Vortex", "Atlas", "Zephyr", "Titan", "Orion", "Breeze"};
    String[] types = {"Road", "Mountain", "Electric", "City", "Kids", "BMX", "Folding", "Gravel"};
    double[] base = {620, 540, 1450, 380, 140, 260, 430, 690}, wt = {8.5, 13.5, 22, 15, 9, 11.5, 12.5, 10.5};
    String[] wheel = {"700c", "27.5\"", "700c", "26\"", "16\"", "20\"", "20\"", "700x40c"}, frames = {"Alloy 6061", "Carbon fibre", "Steel CrMo", "Alloy 7005"}, geared = {"7-speed", "21-speed", "24-speed", "27-speed"};
    String[] colors = {"red", "blue", "black", "green", "orange", "white", "yellow", "teal"};
    String[] desc = {"Lightweight aerodynamic frame built for speed on smooth roads.", "Rugged suspension-ready frame for trails, hills and rough terrain.", "Pedal-assist e-bike with a long-range battery for effortless commuting.",
      "Comfortable upright riding position, perfect for daily city rides.", "Safe, sturdy and fun first bike for young riders.", "Tough compact frame made for tricks, ramps and street riding.",
      "Folds in seconds so you can store it at home or take it on transit.", "Versatile all-road bike that handles gravel, dirt and tarmac."};
    int n = 100;
    for (int t = 0; t < 8; t++) for (int v = 0; v < 12; v++) {
      Product p = new Product(); p.sku = "KR-" + (n++); p.brand = brands[(t + v) % 8]; p.category = types[t]; p.name = p.brand + " " + series[v] + " " + types[t];
      p.price = BigDecimal.valueOf(Math.round(base[t] * (0.8 + v * 0.06))).subtract(new BigDecimal("0.10")); p.stock = v == 0 ? rnd.nextInt(5) + 1 : rnd.nextInt(58) + 2;
      String gear = t == 2 ? "250W motor, 9-speed" : (t == 4 || t == 5) ? "Single speed" : geared[v % 4];
      p.specs = "Frame: " + frames[v % 4] + "|Gears: " + gear + "|Brakes: " + ((t == 0 || t == 1 || t == 2 || t == 7) ? "Hydraulic disc" : "V-brake")
        + "|Weight: " + String.format(Locale.US, "%.1f kg", wt[t] + rnd.nextDouble() * 2) + "|Wheel: " + wheel[t] + "|Warranty: 2 years frame";
      p.colors = colors[v % 8] + "," + colors[(v + 3) % 8] + "," + colors[(v + 5) % 8]; p.description = desc[t] + " " + p.brand + " " + series[v] + " edition."; p.cost = p.price.multiply(new BigDecimal("0.62")); products.save(p);
    }
    String[] acc = {"Helmet", "Light", "Lock", "Pump", "Bottle", "Gloves", "Bag", "Bell"}; double[] ab = {45, 18, 28, 22, 9, 19, 34, 6};
    String[] adesc = {"Impact-absorbing ventilated helmet.", "Rechargeable bright LED light, USB-C.", "Hardened steel anti-theft lock.", "Compact high-pressure pump.", "BPA-free insulated bottle.", "Padded grip gloves.", "Water-resistant frame bag.", "Loud classic bell."};
    for (int t = 0; t < 8; t++) for (int v = 0; v < 7; v++) {
      Product p = new Product(); p.sku = "KR-" + (n++); p.brand = brands[(t + v) % 8]; p.category = "Accessories"; p.name = p.brand + " " + series[v] + " " + acc[t];
      p.price = BigDecimal.valueOf(Math.round(ab[t] * (0.8 + v * 0.1))).subtract(new BigDecimal("0.10")); p.stock = rnd.nextInt(80) + 3; p.reorderLevel = 8;
      p.specs = "Type: " + acc[t] + "|Weight: " + String.format(Locale.US, "%.1f kg", 0.1 + rnd.nextDouble() * 0.6) + "|Warranty: 1 year"; p.colors = colors[v % 8] + "," + colors[(v + 2) % 8];
      p.description = adesc[t] + " " + p.brand + " " + series[v] + " series."; p.cost = p.price.multiply(new BigDecimal("0.62")); products.save(p);
    }
  }
}
