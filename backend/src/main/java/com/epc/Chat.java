package com.epc;
import org.springframework.beans.factory.annotation.Value; import org.springframework.http.*; import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient; import org.springframework.web.server.ResponseStatusException; import java.util.*; import java.util.stream.*;

@RestController @RequestMapping("/api/chat")
class ChatController {
  record Msg(String role, String content) {}
  record Req(String message, List<Msg> history, String lang) {}
  private final ProductRepo products; private final RestClient http = RestClient.create();
  @Value("${anthropic.key:}") private String key; @Value("${anthropic.model:claude-sonnet-5-5}") private String model;
  ChatController(ProductRepo p) { products = p; }
  private static final Map<String, String> SYN = Map.of("電動", "electric", "ロード", "road", "マウンテン", "mountain", "キッズ", "kids", "ヘルメット", "helmet", "折りたたみ", "folding");
  private static final Set<String> STOP = Set.of("the", "and", "for", "you", "what", "how", "bike", "bikes", "which", "best", "have", "any", "price", "much", "stock", "cheapest", "good", "with");

  @PostMapping Map<String, String> chat(@RequestBody Req r) {
    String q = r.message() == null ? "" : r.message().trim();
    if (q.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Empty message");
    List<Product> hits = match(q); String lang = r.lang() == null ? "en" : r.lang();
    if (key.isBlank()) return Map.of("reply", fallback(lang, hits), "mode", "basic");
    try {
      String data = hits.stream().map(p -> p.name + " | " + p.category + " | $" + p.price + " | stock " + p.stock + " | colors " + p.colors + " | " + p.specs + " | " + p.description).collect(Collectors.joining("\n"));
      String sys = "You are the friendly shop assistant of Khit Ride, a bicycle shop, and also an expert on bicycles (types, sizing, gears, maintenance, e-bikes, safety, riding tips). Always reply in the language the customer writes in (Burmese, English, Japanese or any other); UI language hint: " + lang
        + ". Answer shop questions (price, stock, quality, specs) ONLY from the data below; if it is missing, say you are not sure and suggest chatting with our staff. General-knowledge questions can be answered normally. Be concise and friendly. Prices are USD.\n"
        + "Policies (demo): delivery 2-5 days, 14-day returns, 2-year frame warranty. Categories: Road, Mountain, Electric, City, Kids, BMX, Folding, Gravel, Accessories.\nMatching items:\n" + (data.isEmpty() ? "(none matched)" : data);
      List<Map<String, String>> msgs = new ArrayList<>();
      if (r.history() != null) for (Msg m : r.history().subList(Math.max(0, r.history().size() - 8), r.history().size()))
        if (("user".equals(m.role()) || "assistant".equals(m.role())) && m.content() != null) msgs.add(Map.of("role", m.role(), "content", m.content()));
      msgs.add(Map.of("role", "user", "content", q));
      Map<?, ?> res = http.post().uri("https://api.anthropic.com/v1/messages").header("x-api-key", key).header("anthropic-version", "2023-06-01")
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("model", model, "max_tokens", 600, "system", sys, "messages", msgs)).retrieve().body(Map.class);
      String text = ((Map<?, ?>) ((List<?>) res.get("content")).get(0)).get("text").toString();
      return Map.of("reply", text, "mode", "ai");
    } catch (Exception e) { return Map.of("reply", fallback(lang, hits), "mode", "basic"); }
  }

  private List<Product> match(String q) {
    String s = q.toLowerCase(); for (var e : SYN.entrySet()) if (q.contains(e.getKey())) s += " " + e.getValue();
    Set<String> tokens = Arrays.stream(s.split("[^a-z0-9]+")).filter(w -> w.length() >= 3 && !STOP.contains(w)).collect(Collectors.toSet());
    return products.findAll().stream().filter(p -> { String h = (p.name + " " + p.category + " " + p.brand).toLowerCase(); return tokens.stream().anyMatch(h::contains); })
      .sorted(Comparator.comparing((Product p) -> p.price)).limit(8).toList();
  }

  private String fallback(String lang, List<Product> hits) {
    boolean my = "my".equals(lang), ja = "ja".equals(lang);
    if (hits.isEmpty()) return my ? "မင်္ဂလာပါ! စက်ဘီး၊ လျှပ်စစ်စက်ဘီး၊ ကလေးစက်ဘီးနှင့် ပစ္စည်းများအကြောင်း မေးမြန်းနိုင်ပါသည်။ အမျိုးအစား၊ ဈေးနှုန်း သို့မဟုတ် လက်ကျန်ကို မေးကြည့်ပါ။"
      : ja ? "こんにちは！自転車、電動アシスト、キッズ用、アクセサリーをご案内します。種類・価格・在庫などをお気軽にお尋ねください。"
      : "Hi! I can help with bikes, e-bikes, kids' bikes and accessories. Try asking about a type (for example \"electric bikes\" or \"helmets\"), a price, or what is in stock.";
    String head = my ? "ရှာတွေ့သော ပစ္စည်းများ:" : ja ? "該当する商品:" : "Matching items:";
    return head + "\n" + hits.stream().map(p -> "• " + p.name + " – $" + p.price + (my ? " (လက်ကျန် " + p.stock + " ခု)" : ja ? "（在庫 " + p.stock + " 点）" : " (" + p.stock + " in stock)")).collect(Collectors.joining("\n"));
  }
}
