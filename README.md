# KhitRide ERP — Integrated Retail ERP & E-Commerce Platform

A full-stack ERP-style system for a bicycle retailer: customer storefront, point of sale, inventory, purchasing, accounting, CRM and analytics in one database.
Built with Spring Boot (Java 17), React (Vite), PostgreSQL/H2, JWT security and WebSocket real-time updates.
The ERP modules are custom-built for this project (they are not an off-the-shelf SAP/Odoo installation).
Spring Boot 3 (Java 17) + React (Vite) + H2/PostgreSQL + WebSocket (STOMP) real-time updates.

## Run
Backend:  `cd backend && mvn spring-boot:run`   (http://localhost:8081, H2 file DB; use `--spring.profiles.active=postgres` for PostgreSQL)
Frontend: `cd frontend && npm install && npm run dev`   (http://localhost:5173)

## Database
Default: H2 file DB (zero setup). PostgreSQL: `docker compose up -d` then `mvn spring-boot:run -Dspring-boot.run.profiles=postgres`.

## Implemented (v0.1)
- Products & inventory (CRUD, low-stock detection, transactional stock deduction/restoration)
- POS checkout -> order -> payment, order cancellation
- Real-time order and stock-alert broadcast across all open terminals
- Daily revenue summary

## Roadmap (build in this order)
1. JWT auth + roles (ADMIN/CASHIER/MANAGER) with Spring Security
2. Customers, suppliers, purchase orders, goods receiving
3. Invoices/receipts PDF, multiple payment methods, refunds
4. Dashboard charts, reports export (Excel/PDF)
5. Flyway migrations, Docker Compose, unit/integration tests, CI (GitHub Actions)

## v0.2 additions
Fashion storefront + role-based back office. Roles: ADMIN, MANAGER, CASHIER, CUSTOMER (self-register). JWT auth (Spring Security).
Demo logins: admin/admin123, manager/manager123, cashier/cashier123.

## v0.3 Khit Ride
152 bicycles & accessories, light/dark theme, EN/MY/JA, live dashboard, order tracking, customer<->staff chat, AI shop assistant.
AI chatbot: set env var `ANTHROPIC_API_KEY` before starting the backend (PowerShell: `$env:ANTHROPIC_API_KEY="sk-ant-..."`). Without it the bot gives basic catalog answers.
Logins: admin/admin123, manager/manager123, cashier/cashier123, customer/customer123.

## v0.4 (Khit Ride)
Roles: OWNER / MANAGER / STAFF / CUSTOMER. Logins: owner/owner123, manager/manager123, staff/staff123, customer/customer123.
Owner-only: Team & roles, Audit log, Profit & confidential. Owner+Manager: Dashboard, Products, Catalog data (brands/categories/colors).
Every order-status change, product edit and catalog change is recorded in the audit log with the employee name.
Real photos: put category photos in backend/uploads/categories/ (electric.jpg, mountain.jpg ...), hero banner in backend/uploads/hero.jpg, or upload per product in Products > Edit.

## v0.5 - ERP modules, payments, finance
Roles: OWNER / MANAGER / STAFF / CUSTOMER. Logins: owner/owner123, manager/manager123, staff/staff123, customer/customer123.
ERP-style modules built into this project (custom-built, not an off-the-shelf ERP product): Sales & POS, Inventory, Purchasing (suppliers, purchase orders, goods receiving, weighted-average costing),
Accounting (income statement, balance sheet, equity, expenses), CRM (customer chat, announcements), Pricing (discount planner), HR-lite (roles, audit trail).
Payments: sandbox gateway (KBZPay / Wave / AYA / card / cash on delivery). See backend/src/main/java/com/epc/Pay.java for how to plug in a real provider.
Real photos: `PEXELS_KEY=... node tools/fetch-photos.mjs` (free Pexels key) fills backend/uploads/catalog/.
Tests: `cd backend && mvn test`. Docker: `docker compose up --build` (frontend on :3000, API on :8081).
If the app fails after upgrading an old database, stop it and delete the backend/data folder to recreate the database.
