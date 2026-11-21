package com.epc;
import io.jsonwebtoken.*; import io.jsonwebtoken.security.Keys; import jakarta.servlet.*; import jakarta.servlet.http.*;
import org.springframework.boot.web.servlet.FilterRegistrationBean; import org.springframework.context.annotation.*; import org.springframework.http.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken; import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity; import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy; import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder; import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder; import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter; import org.springframework.stereotype.*;
import org.springframework.web.bind.annotation.*; import org.springframework.web.cors.*; import org.springframework.web.filter.OncePerRequestFilter; import org.springframework.web.server.ResponseStatusException;
import org.springframework.data.jpa.repository.JpaRepository; import javax.crypto.SecretKey; import java.io.IOException; import java.util.*;

interface UserRepo extends JpaRepository<AppUser, Long> { Optional<AppUser> findByUsername(String u); }

@Service class JwtService {
  private final SecretKey key = Keys.hmacShaKeyFor("epc-demo-secret-key-change-in-production-0123456789".getBytes());
  String make(String user, String role) { return Jwts.builder().subject(user).claim("role", role).expiration(new Date(System.currentTimeMillis() + 86_400_000)).signWith(key).compact(); }
  Claims parse(String t) { return Jwts.parser().verifyWith(key).build().parseSignedClaims(t).getPayload(); }
}

@Component class JwtFilter extends OncePerRequestFilter {
  private final JwtService jwt; JwtFilter(JwtService j) { jwt = j; }
  protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
    String h = req.getHeader("Authorization");
    if (h != null && h.startsWith("Bearer ")) {
      try { Claims c = jwt.parse(h.substring(7));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(c.getSubject(), null, List.of(new SimpleGrantedAuthority("ROLE_" + c.get("role", String.class)))));
      } catch (Exception ignored) { }
    }
    chain.doFilter(req, res);
  }
}

@Configuration @EnableWebSecurity class SecurityConfig {
  static final String[] STAFF = {"OWNER", "MANAGER", "STAFF"}, BOSS = {"OWNER", "MANAGER"};
  @Bean PasswordEncoder encoder() { return new BCryptPasswordEncoder(); }
  @Bean FilterRegistrationBean<JwtFilter> jwtOnlyInSecurityChain(JwtFilter f) { var r = new FilterRegistrationBean<>(f); r.setEnabled(false); return r; }
  @Bean CorsConfigurationSource corsConfigurationSource(@org.springframework.beans.factory.annotation.Value("${app.cors-origins:}") String extra) {
    var c = new CorsConfiguration(); java.util.List<String> origins = new java.util.ArrayList<>(List.of("http://localhost:*", "http://127.0.0.1:*", "http://192.168.*:*", "http://10.*:*"));
    for (String o : extra.split(",")) if (!o.isBlank()) origins.add(o.trim());
    c.setAllowedOriginPatterns(origins); c.setAllowedMethods(List.of("*")); c.setAllowedHeaders(List.of("*"));
    var s = new UrlBasedCorsConfigurationSource(); s.registerCorsConfiguration("/**", c); return s;
  }
  static void json(HttpServletResponse res, int code, String msg) throws IOException { res.setStatus(code); res.setContentType("application/json;charset=UTF-8"); res.getWriter().write("{\"message\":\"" + msg + "\"}"); }
  @Bean SecurityFilterChain chain(HttpSecurity h, JwtFilter f) throws Exception {
    return h.csrf(c -> c.disable()).cors(Customizer.withDefaults()).sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
      .exceptionHandling(e -> e.authenticationEntryPoint((q, res, ex) -> json(res, 401, "Please sign in to continue. Your session may have expired."))
        .accessDeniedHandler((q, res, ex) -> json(res, 403, "Your account role is not allowed to do this. Ask the Owner for access.")))
      .authorizeHttpRequests(a -> a
        .requestMatchers("/error", "/ws/**", "/api/auth/**", "/api/chat").permitAll()
        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
        .requestMatchers(HttpMethod.GET, "/uploads/**", "/api/products", "/api/master/**").permitAll()
        .requestMatchers(HttpMethod.GET, "/api/users/customers").hasAnyRole(BOSS)
        .requestMatchers("/api/users/**", "/api/audit/**", "/api/finance/**", "/api/expenses/**", "/api/promotions/**").hasRole("OWNER")
        .requestMatchers("/api/reports/**", "/api/suppliers/**", "/api/broadcasts/**").hasAnyRole(BOSS)
        .requestMatchers(HttpMethod.GET, "/api/products/low-stock").hasAnyRole(STAFF)
        .requestMatchers("/api/purchase-orders/*/pay").hasRole("OWNER")
        .requestMatchers(HttpMethod.GET, "/api/purchase-orders/**").hasAnyRole(STAFF)
        .requestMatchers("/api/purchase-orders/*/receive").hasAnyRole(STAFF)
        .requestMatchers("/api/purchase-orders/**").hasAnyRole(BOSS)
        .requestMatchers("/api/products/**", "/api/master/**").hasAnyRole(BOSS)
        .requestMatchers("/api/orders/*/status", "/api/orders/*/history", "/api/orders/pos", "/api/support/admin/**").hasAnyRole(STAFF)
        .requestMatchers(HttpMethod.GET, "/api/orders").hasAnyRole(STAFF)
        .anyRequest().authenticated())
      .addFilterBefore(f, UsernamePasswordAuthenticationFilter.class).build();
  }
}

@RestController @RequestMapping("/api/auth") class AuthController {
  record Creds(String username, String password) {}
  private final UserRepo users; private final PasswordEncoder enc; private final JwtService jwt;
  AuthController(UserRepo u, PasswordEncoder e, JwtService j) { users = u; enc = e; jwt = j; }
  @PostMapping("/login") Map<String, Object> login(@RequestBody Creds c) {
    AppUser u = users.findByUsername(c.username()).filter(x -> enc.matches(c.password(), x.passwordHash))
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Wrong username or password. Please check and try again."));
    return Map.of("token", jwt.make(u.username, u.role), "username", u.username, "role", u.role);
  }
  @PostMapping("/register") Map<String, Object> register(@RequestBody Creds c) {
    if (c.username() == null || c.username().trim().length() < 3 || c.password() == null || c.password().length() < 6)
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please use a username of at least 3 characters and a password of at least 6 characters.");
    if (users.findByUsername(c.username().trim()).isPresent()) throw new ResponseStatusException(HttpStatus.CONFLICT, "That username is already taken. Try another one or sign in.");
    AppUser u = new AppUser(); u.username = c.username().trim(); u.passwordHash = enc.encode(c.password()); u.role = "CUSTOMER"; users.save(u);
    return login(new Creds(u.username, c.password()));
  }
}
