import {
  pgTable, uuid, text, integer, numeric, boolean,
  timestamp, date, jsonb, pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", [
  "owner", "store_manager", "store_employee", "production_employee", "accountant",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "draft", "confirmed", "in_production", "ready", "delivered", "cancelled",
]);

export const orderTypeEnum = pgEnum("order_type", [
  "custom", "ready_made", "correction",
]);

export const productionStatusEnum = pgEnum("production_status", [
  "queued", "in_progress", "done", "sent_to_store",
]);

export const correctionStatusEnum = pgEnum("correction_status", [
  "open", "in_production", "resolved", "not_resolved",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash", "card", "transfer",
]);

export const movementTypeEnum = pgEnum("movement_type", [
  "receive", "reserve", "release", "sell", "adjust",
]);

// ─── Companies ───────────────────────────────────────────────────────────────

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  country: text("country").notNull(),
  taxId: text("tax_id"),
  address: text("address"),
  currency: text("currency").default("EUR").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Users (extends Supabase Auth) ───────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey(), // matches auth.users.id
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  role: userRoleEnum("role").default("store_employee").notNull(),
  companyId: uuid("company_id").references(() => companies.id),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Customers ────────────────────────────────────────────────────────────────

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone").notNull(),
  city: text("city"),
  address: text("address"),
  dateOfBirth: date("date_of_birth"),
  notes: text("notes"),
  templateNumber: text("template_number"),
  loyaltyPoints: integer("loyalty_points").default(0).notNull(),
  loyaltyTier: text("loyalty_tier").default("Bronze").notNull(),
  firstVisitDate: date("first_visit_date"),
  lastVisitDate: date("last_visit_date"),
  totalSpent: numeric("total_spent", { precision: 10, scale: 2 }).default("0").notNull(),
  visitCount: integer("visit_count").default(0).notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

// ─── Customer Measurements ────────────────────────────────────────────────────

export const customerMeasurements = pgTable("customer_measurements", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  label: text("label").default("košulja").notNull(),
  data: jsonb("data").notNull(), // { vrat, grudi, struk, kuk, rame, rukav, duzina }
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: uuid("created_by").references(() => users.id),
});

// ─── Materials ────────────────────────────────────────────────────────────────

export const materials = pgTable("materials", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  name: text("name").notNull(),
  code: text("code"),
  barcode: text("barcode"),
  category: text("category"),
  unit: text("unit").default("m").notNull(),
  currentStock: numeric("current_stock", { precision: 10, scale: 2 }).default("0").notNull(),
  reservedStock: numeric("reserved_stock", { precision: 10, scale: 2 }).default("0").notNull(),
  reorderLevel: numeric("reorder_level", { precision: 10, scale: 2 }).default("5"),
  lastPurchasePrice: numeric("last_purchase_price", { precision: 10, scale: 2 }),
  averageCost: numeric("average_cost", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Inventory Items (ready-made goods) ──────────────────────────────────────

export const inventoryItems = pgTable("inventory_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  name: text("name").notNull(),
  sku: text("sku"),
  barcode: text("barcode"),
  category: text("category"),
  quantity: integer("quantity").default(0).notNull(),
  reservedQuantity: integer("reserved_quantity").default(0).notNull(),
  salePrice: numeric("sale_price", { precision: 10, scale: 2 }),
  costPrice: numeric("cost_price", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Orders ───────────────────────────────────────────────────────────────────

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  orderNumber: text("order_number").notNull(),
  customerId: uuid("customer_id").references(() => customers.id),
  orderType: orderTypeEnum("order_type").default("custom").notNull(),
  status: orderStatusEnum("status").default("draft").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  dueDate: date("due_date"),
  completedAt: timestamp("completed_at"),
  deliveredAt: timestamp("delivered_at"),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).default("0").notNull(),
  paidAmount: numeric("paid_amount", { precision: 10, scale: 2 }).default("0").notNull(),
  paymentStatus: text("payment_status").default("unpaid").notNull(),
  notes: text("notes"),
  // Custom order specific fields (denormalized for simplicity)
  item: text("item"),
  material: text("material"),
  templateNumber: text("template_number"),
  collarType: text("collar_type"),
  sleeveType: text("sleeve_type"),
  fitType: text("fit_type"),
  measurementSnapshot: jsonb("measurement_snapshot"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Material Reservations ────────────────────────────────────────────────────

export const materialReservations = pgTable("material_reservations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  materialId: uuid("material_id").references(() => materials.id).notNull(),
  quantityReserved: numeric("quantity_reserved", { precision: 10, scale: 2 }).notNull(),
  quantityUsed: numeric("quantity_used", { precision: 10, scale: 2 }).default("0"),
  status: text("status").default("reserved").notNull(), // reserved | consumed | released
  createdAt: timestamp("created_at").defaultNow().notNull(),
  releasedAt: timestamp("released_at"),
});

// ─── Production Tasks ─────────────────────────────────────────────────────────

export const productionTasks = pgTable("production_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
  correctionId: uuid("correction_id"),
  assignedTo: uuid("assigned_to").references(() => users.id),
  priority: text("priority").default("medium").notNull(),
  status: productionStatusEnum("status").default("queued").notNull(),
  notesFromStore: text("notes_from_store"),
  notesFromProduction: text("notes_from_production"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  dueDate: date("due_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Corrections ──────────────────────────────────────────────────────────────

export const corrections = pgTable("corrections", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  orderId: uuid("order_id").references(() => orders.id),
  customerId: uuid("customer_id").references(() => customers.id),
  correctionType: text("correction_type").notNull(),
  description: text("description").notNull(),
  cause: text("cause"),
  solution: text("solution"),
  status: correctionStatusEnum("status").default("open").notNull(),
  affectsTemplate: boolean("affects_template").default(false).notNull(),
  templateNote: text("template_note"),
  dueDate: date("due_date"),
  resolvedAt: timestamp("resolved_at"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Inventory Movements ──────────────────────────────────────────────────────

export const inventoryMovements = pgTable("inventory_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  itemType: text("item_type").notNull(), // material | inventory_item
  itemId: uuid("item_id").notNull(),
  movementType: movementTypeEnum("movement_type").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
  referenceId: uuid("reference_id"), // order_id or invoice_id
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Sales ────────────────────────────────────────────────────────────────────

export const sales = pgTable("sales", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  saleNumber: text("sale_number").notNull(),
  customerId: uuid("customer_id").references(() => customers.id),
  createdBy: uuid("created_by").references(() => users.id),
  paymentMethod: paymentMethodEnum("payment_method").default("cash").notNull(),
  status: text("status").default("completed").notNull(),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const saleItems = pgTable("sale_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  saleId: uuid("sale_id").references(() => sales.id, { onDelete: "cascade" }).notNull(),
  itemName: text("item_name").notNull(),
  inventoryItemId: uuid("inventory_item_id").references(() => inventoryItems.id),
  quantity: integer("quantity").default(1).notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
});

// ─── Payments ─────────────────────────────────────────────────────────────────

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  referenceType: text("reference_type").notNull(), // order | sale
  referenceId: uuid("reference_id").notNull(),
  customerId: uuid("customer_id").references(() => customers.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum("payment_method").default("cash").notNull(),
  paymentDate: date("payment_date").notNull(),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Loyalty Events ───────────────────────────────────────────────────────────

export const loyaltyEvents = pgTable("loyalty_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  eventType: text("event_type").notNull(), // earn | redeem | adjust | expire
  points: integer("points").notNull(),
  referenceType: text("reference_type"),
  referenceId: uuid("reference_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Appointments ────────────────────────────────────────────────────────────

export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  customerId: uuid("customer_id").references(() => customers.id),
  employeeId: uuid("employee_id").references(() => users.id),
  scheduledAt: timestamp("scheduled_at").notNull(),
  durationMinutes: integer("duration_minutes").default(60).notNull(),
  type: text("type").default("merenje").notNull(), // merenje | proba | isporuka | konsultacija | ostalo
  status: text("status").default("scheduled").notNull(), // scheduled | completed | cancelled | no_show
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Suppliers ────────────────────────────────────────────────────────────────

export const suppliers = pgTable("suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  country: text("country"),
  taxId: text("tax_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Supplier Invoices ────────────────────────────────────────────────────────

export const supplierInvoices = pgTable("supplier_invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  invoiceNumber: text("invoice_number").notNull(),
  invoiceDate: date("invoice_date").notNull(),
  currency: text("currency").default("EUR").notNull(),
  exchangeRate: numeric("exchange_rate", { precision: 10, scale: 4 }).default("1"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).default("0").notNull(),
  totalAdditionalCosts: numeric("total_additional_costs", { precision: 10, scale: 2 }).default("0").notNull(),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).default("0").notNull(),
  status: text("status").default("draft").notNull(), // draft | verified | posted
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Supplier Invoice Items ───────────────────────────────────────────────────

export const supplierInvoiceItems = pgTable("supplier_invoice_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id").references(() => supplierInvoices.id, { onDelete: "cascade" }).notNull(),
  materialId: uuid("material_id").references(() => materials.id),
  inventoryItemId: uuid("inventory_item_id").references(() => inventoryItems.id),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
  allocatedAdditionalCost: numeric("allocated_additional_cost", { precision: 10, scale: 2 }).default("0"),
  finalUnitCost: numeric("final_unit_cost", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Invoice Additional Costs ─────────────────────────────────────────────────

export const invoiceAdditionalCosts = pgTable("invoice_additional_costs", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id").references(() => supplierInvoices.id, { onDelete: "cascade" }).notNull(),
  costType: text("cost_type").notNull(), // transport | customs_duty | customs_fee | other
  description: text("description"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  customsDutyRate: numeric("customs_duty_rate", { precision: 5, scale: 2 }), // % stopa carine
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id),
  userId: uuid("user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Relations ───────────────────────────────────────────────────────────────

export const customersRelations = relations(customers, ({ many }) => ({
  measurements: many(customerMeasurements),
  orders: many(orders),
  corrections: many(corrections),
}));

export const customerMeasurementsRelations = relations(customerMeasurements, ({ one }) => ({
  customer: one(customers, { fields: [customerMeasurements.customerId], references: [customers.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
  productionTasks: many(productionTasks),
  corrections: many(corrections),
}));

export const productionTasksRelations = relations(productionTasks, ({ one }) => ({
  order: one(orders, { fields: [productionTasks.orderId], references: [orders.id] }),
}));

export const correctionsRelations = relations(corrections, ({ one }) => ({
  customer: one(customers, { fields: [corrections.customerId], references: [customers.id] }),
  order: one(orders, { fields: [corrections.orderId], references: [orders.id] }),
}));

export const usersRelations = relations(users, ({ one }) => ({
  company: one(companies, { fields: [users.companyId], references: [companies.id] }),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  customer: one(customers, { fields: [sales.customerId], references: [customers.id] }),
  items: many(saleItems),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, { fields: [saleItems.saleId], references: [sales.id] }),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  customer: one(customers, { fields: [appointments.customerId], references: [customers.id] }),
}));

export const suppliersRelations = relations(suppliers, ({ one, many }) => ({
  company: one(companies, { fields: [suppliers.companyId], references: [companies.id] }),
  invoices: many(supplierInvoices),
}));

export const supplierInvoicesRelations = relations(supplierInvoices, ({ one, many }) => ({
  supplier: one(suppliers, { fields: [supplierInvoices.supplierId], references: [suppliers.id] }),
  items: many(supplierInvoiceItems),
  additionalCosts: many(invoiceAdditionalCosts),
}));

export const supplierInvoiceItemsRelations = relations(supplierInvoiceItems, ({ one }) => ({
  invoice: one(supplierInvoices, { fields: [supplierInvoiceItems.invoiceId], references: [supplierInvoices.id] }),
  material: one(materials, { fields: [supplierInvoiceItems.materialId], references: [materials.id] }),
  inventoryItem: one(inventoryItems, { fields: [supplierInvoiceItems.inventoryItemId], references: [inventoryItems.id] }),
}));

export const invoiceAdditionalCostsRelations = relations(invoiceAdditionalCosts, ({ one }) => ({
  invoice: one(supplierInvoices, { fields: [invoiceAdditionalCosts.invoiceId], references: [supplierInvoices.id] }),
}));

// ─── Types ────────────────────────────────────────────────────────────────────

export type Company = typeof companies.$inferSelect;
export type User = typeof users.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type CustomerMeasurement = typeof customerMeasurements.$inferSelect;
export type Material = typeof materials.$inferSelect;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type ProductionTask = typeof productionTasks.$inferSelect;
export type Correction = typeof corrections.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;

export type Appointment = typeof appointments.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type SupplierInvoice = typeof supplierInvoices.$inferSelect;
export type SupplierInvoiceItem = typeof supplierInvoiceItems.$inferSelect;
export type InvoiceAdditionalCost = typeof invoiceAdditionalCosts.$inferSelect;

export type InsertCustomer = typeof customers.$inferInsert;
export type InsertOrder = typeof orders.$inferInsert;
export type InsertCorrection = typeof corrections.$inferInsert;
export type InsertMaterial = typeof materials.$inferInsert;
export type InsertSale = typeof sales.$inferInsert;
