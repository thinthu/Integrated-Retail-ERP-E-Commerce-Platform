package com.epc;
import org.springframework.data.jpa.repository.*; import java.time.Instant; import java.util.List;
interface ProductRepo extends JpaRepository<Product, Long> { @Query("select p from Product p where p.stock <= p.reorderLevel") List<Product> lowStock(); }
interface OrderRepo extends JpaRepository<CustomerOrder, Long> { List<CustomerOrder> findTop50ByOrderByCreatedAtDesc(); List<CustomerOrder> findByCustomerOrderByCreatedAtDesc(String c); }
interface MsgRepo extends JpaRepository<SupportMessage, Long> { List<SupportMessage> findByCustomerOrderByCreatedAtAsc(String c); @Query("select distinct m.customer from SupportMessage m") List<String> customers(); }
interface MasterRepo extends JpaRepository<MasterItem, Long> { List<MasterItem> findByTypeOrderByName(String t); boolean existsByTypeAndNameIgnoreCase(String t, String n); }
interface AuditRepo extends JpaRepository<AuditLog, Long> { List<AuditLog> findTop300ByOrderByCreatedAtDesc(); List<AuditLog> findByTargetOrderByCreatedAtDesc(String t); }
interface NoticeRepo extends JpaRepository<Notice, Long> { List<Notice> findTop30ByAudienceInOrderByCreatedAtDesc(java.util.Collection<String> a); }
interface PaymentRepo extends JpaRepository<Payment, Long> { List<Payment> findByPaidAtAfter(Instant t); }
interface SupplierRepo extends JpaRepository<Supplier, Long> { }
interface PoRepo extends JpaRepository<PurchaseOrder, Long> { List<PurchaseOrder> findAllByOrderByCreatedAtDesc(); }
interface ExpenseRepo extends JpaRepository<Expense, Long> { List<Expense> findAllByOrderBySpentAtDesc(); }
interface SettingRepo extends JpaRepository<Setting, String> { }
interface BroadcastRepo extends JpaRepository<Broadcast, Long> { List<Broadcast> findTop30ByOrderByCreatedAtDesc(); }
interface PaySessionRepo extends JpaRepository<PaymentSession, String> { }
