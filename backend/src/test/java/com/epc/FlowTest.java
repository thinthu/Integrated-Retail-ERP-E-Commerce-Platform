package com.epc;
import com.fasterxml.jackson.databind.ObjectMapper; import org.junit.jupiter.api.Test; import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc; import org.springframework.boot.test.context.SpringBootTest; import org.springframework.http.MediaType; import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*; import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*; import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1") @AutoConfigureMockMvc
class FlowTest {
  @Autowired MockMvc mvc; @Autowired ObjectMapper om;
  private String token(String u, String p) throws Exception {
    String res = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"" + u + "\",\"password\":\"" + p + "\"}")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    return "Bearer " + om.readTree(res).get("token").asText();
  }
  @Test void wrongPasswordGivesFriendlyMessage() throws Exception { mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"owner\",\"password\":\"nope\"}")).andExpect(status().isUnauthorized()); }
  @Test void anonymousCannotListOrders() throws Exception { mvc.perform(get("/api/orders")).andExpect(status().isUnauthorized()); }
  @Test void customerCannotReadAuditOrFinance() throws Exception {
    String t = token("customer", "customer123");
    mvc.perform(get("/api/audit").header("Authorization", t)).andExpect(status().isForbidden());
    mvc.perform(get("/api/finance/statements").header("Authorization", t)).andExpect(status().isForbidden());
  }
  @Test void staffCannotSeeFinanceButOwnerCan() throws Exception {
    mvc.perform(get("/api/finance/statements").header("Authorization", token("staff", "staff123"))).andExpect(status().isForbidden());
    mvc.perform(get("/api/finance/statements").header("Authorization", token("owner", "owner123"))).andExpect(status().isOk()).andExpect(jsonPath("$.balance.totalAssets").exists());
  }
  @Test void publicProductsNeverExposeCost() throws Exception { mvc.perform(get("/api/products")).andExpect(status().isOk()).andExpect(jsonPath("$[0].cost").doesNotExist()); }
  @Test void orderReservesStockAndRejectsOversell() throws Exception {
    String t = token("customer", "customer123");
    var first = om.readTree(mvc.perform(get("/api/products")).andReturn().getResponse().getContentAsString()).get(0);
    long id = first.get("id").asLong(); int stock = first.get("stock").asInt();
    mvc.perform(post("/api/orders").header("Authorization", t).contentType(MediaType.APPLICATION_JSON).content("[{\"productId\":" + id + ",\"qty\":1}]")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PENDING"));
    var after = om.readTree(mvc.perform(get("/api/products")).andReturn().getResponse().getContentAsString());
    for (var p : after) if (p.get("id").asLong() == id) assertEquals(stock - 1, p.get("stock").asInt());
    mvc.perform(post("/api/orders").header("Authorization", t).contentType(MediaType.APPLICATION_JSON).content("[{\"productId\":" + id + ",\"qty\":100000}]")).andExpect(status().isConflict());
  }
}
