import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

type AdminPage =
  | "orders"
  | "requests"
  | "products"
  | "shirt-types"
  | "categories"
  | "discounts"
  | "payments"
  | "delivery"
  | "analytics"
  | "settings";
type Order = {
  id: string;
  order_code: string;
  order_type: string;
  status: string;
  payment_status: string;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_request?: string | null;
  customer_artwork_path?: string | null;
  selected_design_snapshot?: unknown;
  proof_image_path?: string | null;
  delivery_area?: string | null;
  delivery_address?: string | null;
  delivery_instructions?: string | null;
  subtotal?: number | string;
  discount_amount?: number | string;
  discount_id?: string | null;
  delivery_fee?: number | string;
  total_amount: number | string;
  amount_paid: number | string;
  amount_refunded: number | string;
  currency_code: string;
  rush_days_early: number;
  rush_fee?: number | string;
  availability_confirmed_at?: string | null;
  payment_link?: string | null;
  payment_link_expiry?: string | null;
  approval_status?: string;
  cost_price_locked?: number | string | null;
  supplier_cost?: number | string | null;
  profit?: number | string | null;
  cost_locked_at?: string | null;
  actual_sourcing_cost: number | string;
  actual_printing_cost: number | string;
  actual_delivery_cost: number | string;
  actual_payment_fee: number | string;
  actual_other_cost: number | string;
  actual_costs_recorded_at: string | null;
  created_at: string;
  order_items?: {
    quantity: number;
    store_item_id: string | null;
    product_name_snapshot: string;
    requested_size: string | null;
    requested_color: string | null;
    quoted_unit_price: number | string;
  }[];
};
type StoreItem = {
  id: string;
  name: string;
  category: string;
  category_id?: string | null;
  description: string;
  price: number | string;
  image_paths: string[];
  size_options: string[];
  color_options: string[];
  is_published: boolean;
  is_available: boolean;
  stock_quantity: number | null;
  purchase_cost?: number | string | null;
  other_cost?: number | string | null;
};
type ProductVariant = {
  id: string;
  product_id: string;
  size: string;
  color: string;
  stock: number;
  selling_price: number | string;
  status: string;
  cost_price?: number | string | null;
};
type VariantDraft = {
  size: string;
  color: string;
  stock: string;
  selling_price: string;
  cost_price: string;
};
type GalleryDesign = {
  id: string;
  title: string | null;
  category: string;
  image_path: string;
  preview_path: string | null;
  published: boolean;
};
type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image_url: string | null;
  status: "active" | "hidden" | "archived";
  created_at: string;
};
type Discount = {
  id: string;
  code: string;
  type: "percentage" | "fixed";
  value: number | string;
  max_cap: number | string | null;
  start_date: string | null;
  end_date: string | null;
  total_limit: number | null;
  per_customer_limit: number | null;
  min_order_amount: number | string;
  applies_to: "shop" | "explore" | "both";
  status: "draft" | "active" | "inactive" | "archived";
  used_count: number;
};
type Payment = {
  id: string;
  order_id: string;
  transaction_type: string;
  status: string;
  provider: string | null;
  provider_reference: string | null;
  amount: number | string;
  currency_code: string;
  created_at: string;
  orders?: {
    order_code: string;
    customer_name: string;
    order_type?: string;
  } | null;
};
type Delivery = {
  campus_handoff_fee: number | string;
  sister_office_handoff_fee: number | string;
  free_delivery_areas: string[];
} | null;
type DeliveryArea = {
  id: string;
  region: string;
  area: string;
  fee: number | string;
  free_delivery: boolean;
  status: string;
  updated_at: string;
};
type Settings = {
  store_name: string;
  whatsapp_number: string;
  delivery_min_days: number;
  delivery_max_days: number;
  urgent_fee_per_day_percent: number;
} | null;
type Preferences = {
  owner_name: string;
  owner_phone: string;
  quote_whatsapp_template: string;
  dispatched_whatsapp_template: string;
  notify_paid_orders: boolean;
  notify_design_requests: boolean;
  notify_low_stock: boolean;
};
type Data = {
  orders: Order[];
  products: StoreItem[];
  shirtTypes: ShirtType[];
  variants: ProductVariant[];
  designs: GalleryDesign[];
  categories: Category[];
  discounts: Discount[];
  payments: Payment[];
  delivery: Delivery;
  deliveryAreas: DeliveryArea[];
  settings: Settings;
  preferences: Preferences | null;
};
type ShirtType = {
  id: string;
  name: string;
  category: string;
  usual_sizes: string[];
  usual_colors: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const heads: Record<AdminPage, [string, string]> = {
  orders: ["OPERATIONS / SHOP", "Shop Orders"],
  requests: ["OPERATIONS / CUSTOM", "Design Requests"],
  products: ["CATALOGUE", "Products"],
  "shirt-types": ["CATALOGUE", "Shirt Types"],
  categories: ["CATALOGUE", "Categories"],
  discounts: ["MARKETING", "Discounts"],
  payments: ["FINANCE", "Payments"],
  delivery: ["OPERATIONS", "Delivery Settings"],
  analytics: ["BUSINESS INTELLIGENCE", "Analytics"],
  settings: ["WORKSPACE", "Settings"],
};
const statuses = [
  "request_received",
  "awaiting_payment",
  "paid",
  "design_in_progress",
  "proof_sent",
  "revision_requested",
  "proof_approved",
  "sourcing",
  "alternative_offered",
  "refund_pending",
  "refunded",
  "in_production",
  "ready_for_handoff",
  "out_for_delivery",
  "delivered",
  "completed",
  "cancelled",
];
const split = (value: string) => [
  ...new Set(
    value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ),
];

export default function AdminSections({
  page,
  data,
  onRefresh,
  onCatalogRefresh,
  onDiscountSaved,
  onEnablePush,
  pushStatus,
  pushEnabled,
}: {
  page: AdminPage;
  data: Data;
  onRefresh: () => void;
  onCatalogRefresh: () => void;
  onDiscountSaved: (discount: Discount) => void;
  onEnablePush: () => void;
  pushStatus: string;
  pushEnabled: boolean;
}) {
  const [notice, setNotice] = useState("");
  const say = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 4000);
  };
  const [eyebrow, title] = heads[page];
  return (
    <>
      {notice && (
        <div className="admin-data-notice" role="status">
          {notice}
        </div>
      )}
      {page === "orders" && (
        <OrdersPage
          title={title}
          rows={data.orders.filter((o) => o.order_type === "store_purchase")}
          designs={data.designs}
          discounts={data.discounts}
          onRefresh={onRefresh}
          say={say}
        />
      )}
      {page === "requests" && (
        <OrdersPage
          title={title}
          rows={data.orders.filter((o) => o.order_type !== "store_purchase")}
          designs={data.designs}
          discounts={data.discounts}
          onRefresh={onRefresh}
          say={say}
        />
      )}
{page === "products" && (
        <ProductsPage
          rows={data.products}
          variants={data.variants}
          designs={data.designs}
          categories={data.categories}
          onRefresh={onRefresh}
          onCatalogRefresh={onCatalogRefresh}
          say={say}
        />
      )}
      {page === "shirt-types" && (
        <ShirtTypesPage
          rows={data.shirtTypes}
          onRefresh={onRefresh}
          say={say}
        />
      )}
      {page === "categories" && (
        <CategoriesPage
          rows={data.categories}
          products={data.products}
          onRefresh={onRefresh}
          say={say}
        />
      )}
      {page === "discounts" && (
        <DiscountsPage
          rows={data.discounts}
          onRefresh={onRefresh}
          onSaved={onDiscountSaved}
          say={say}
        />
      )}
      {page === "payments" && (
        <PaymentsPage
          rows={data.payments}
          orders={data.orders}
          onRefresh={onRefresh}
        />
      )}
      {page === "delivery" && (
        <DeliveryPage
          value={data.delivery}
          areas={data.deliveryAreas}
          settings={data.settings}
          onRefresh={onRefresh}
          say={say}
        />
      )}
      {page === "settings" && (
        <SettingsPage
          value={data.settings}
          preferences={data.preferences}
          onRefresh={onRefresh}
          say={say}
          onEnablePush={onEnablePush}
          pushStatus={pushStatus}
          pushEnabled={pushEnabled}
        />
      )}
      {page === "analytics" && (
        <AnalyticsPage orders={data.orders} products={data.products} />
      )}
      {page !== "orders" &&
        page !== "requests" &&
        page !== "products" &&
        page !== "categories" &&
        page !== "discounts" &&
        page !== "payments" &&
        page !== "delivery" &&
        page !== "analytics" &&
        page !== "settings" && <PageHead eyebrow={eyebrow} title={title} />}
    </>
  );
}

function PageHead({
  eyebrow,
  title,
  action,
  onAction,
}: {
  eyebrow: string;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="a-page-head">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      {action && (
        <button className="a-button dark" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}
function Status({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  const label = String(children);
  return (
    <span
      className={`a-status ${tone || label.toLowerCase().replaceAll(" ", "-")}`}
    >
      {children}
    </span>
  );
}
function PanelHead({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="panel-head">
      <h2>{title}</h2>
      {meta && <span>{meta}</span>}
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="admin-empty-state">{children}</p>;
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="drawer-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <aside className="admin-drawer wide">
        <header>
          <div>
            <span>WEARWISE / ADMIN</span>
            <h2>{title}</h2>
          </div>
          <button type="button" onClick={close} aria-label="Close">
            ×
          </button>
        </header>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

function OrdersPage({
  title,
  rows,
  discounts,
  designs,
  onRefresh,
  say,
}: {
  title: string;
  rows: Order[];
  discounts: Discount[];
  designs: GalleryDesign[];
  onRefresh: () => void;
  say: (s: string) => void;
}) {
  const [busy, setBusy] = useState("");
  const [costEditing, setCostEditing] = useState<Order | null>(null);
  const [selected, setSelected] = useState<Order | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [tab, setTab] = useState("All");
  const isRequests = title === "Design Requests";
  const visible = rows.filter((o) => {
    const q = search.trim().toLowerCase();
    const matchesText =
      !q ||
      `${o.order_code} ${o.customer_name} ${o.customer_phone ?? ""}`
        .toLowerCase()
        .includes(q);
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    const matchesArea = areaFilter === "all" || o.delivery_area === areaFilter;
    const matchesDate =
      !dateFilter ||
      new Date(o.created_at).toISOString().slice(0, 10) === dateFilter;
    const matchesTab =
      tab === "All" ||
      (tab === "New" &&
        ["request_received", "awaiting_payment"].includes(o.status)) ||
      (tab === "Quoted" && o.status === "awaiting_payment") ||
      (tab === "Paid" && ["paid", "design_in_progress"].includes(o.status)) ||
      (tab === "In Production" &&
        ["in_production", "design_in_progress"].includes(o.status)) ||
      (tab === "Delivered" && ["delivered", "completed"].includes(o.status));
    return (
      matchesText && matchesStatus && matchesArea && matchesDate && matchesTab
    );
  });
  async function change(id: string, status: string) {
    setBusy(id);
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id);
    if (error) say(`Could not update: ${error.message}`);
    else {
      say("Order status updated.");
      onRefresh();
    }
    setBusy("");
  }
  async function removeOrder(row: Order) {
    if (!window.confirm(`Delete ${row.order_code}? This cannot be undone.`))
      return;
    const { error } = await supabase.from("orders").delete().eq("id", row.id);
    if (error)
      say(
        `Could not delete ${isRequests ? "request" : "order"}: ${error.message}`,
      );
    else {
      say(`${isRequests ? "Request" : "Order"} deleted.`);
      onRefresh();
    }
  }
  async function saveCosts(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!costEditing) return;
    setBusy(costEditing.id);
    const f = new FormData(e.currentTarget),
      value = (key: string) => {
        const raw = String(f.get(key) ?? "").trim();
        return raw === "" ? 0 : Number(raw);
      };
    const sourcing = value("sourcing"),
      printing = value("printing"),
      delivery = value("delivery"),
      payment = value("payment"),
      other = value("other"),
      locked = f.get("lock") === "on",
      now = new Date().toISOString();
    const costs = {
      actual_sourcing_cost: sourcing,
      actual_printing_cost: printing,
      actual_delivery_cost: delivery,
      actual_payment_fee: payment,
      actual_other_cost: other,
      actual_costs_recorded_at: now,
      cost_price_locked: locked ? sourcing : null,
      supplier_cost: locked ? sourcing : null,
      profit: locked
        ? Number(costEditing.total_amount) -
          sourcing -
          printing -
          delivery -
          payment -
          other
        : null,
      cost_locked_at: locked ? now : null,
    };
    const { error } = await supabase
      .from("orders")
      .update(costs)
      .eq("id", costEditing.id);
    if (error) say(`Could not save order costs: ${error.message}`);
    else {
      say("Order costs saved for analytics.");
      setCostEditing(null);
      onRefresh();
    }
    setBusy("");
  }
  return (
    <>
      <PageHead
        eyebrow={isRequests ? "OPERATIONS / CUSTOM" : "OPERATIONS / SHOP"}
        title={title}
        action={isRequests ? undefined : "Create order"}
        onAction={() => say("Orders are created from customer checkout.")}
      />
      {isRequests && (
        <div className="admin-tabs">
          {["All", "New", "Quoted", "Paid", "In Production", "Delivered"].map(
            (x) => (
              <button
                className={tab === x ? "active" : ""}
                onClick={() => setTab(x)}
                key={x}
              >
                {x}
                <span>
                  {x === "All"
                    ? rows.length
                    : rows.filter((o) =>
                        x === "New"
                          ? ["request_received", "awaiting_payment"].includes(
                              o.status,
                            )
                          : x === "Quoted"
                            ? o.status === "awaiting_payment"
                            : x === "Paid"
                              ? ["paid", "design_in_progress"].includes(
                                  o.status,
                                )
                              : x === "In Production"
                                ? [
                                    "in_production",
                                    "design_in_progress",
                                  ].includes(o.status)
                                : ["delivered", "completed"].includes(o.status),
                      ).length}
                </span>
              </button>
            ),
          )}
        </div>
      )}
      <div className="filter-bar">
        <label className="a-search">
          ⌕
          <input
            placeholder={
              isRequests ? "Search requests..." : "Search by code or phone..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All statuses</option>
          {[...new Set(rows.map((o) => o.status))].map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <input
          type="date"
          aria-label="Filter date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
        <select
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
        >
          <option value="all">All areas</option>
          {[...new Set(rows.map((o) => o.delivery_area).filter(Boolean))].map(
            (a) => (
              <option key={a} value={a!}>
                {a}
              </option>
            ),
          )}
        </select>
        <button
          type="button"
          onClick={() => {
            setSearch("");
            setStatusFilter("all");
            setAreaFilter("all");
            setDateFilter("");
          }}
        >
          Clear filters
        </button>
      </div>
      <section className="a-panel table-panel">
        <div className="bulk-bar">
          <span>
            {isRequests ? "All requests" : "All orders"} <b>{visible.length}</b>
          </span>
          <div>
            <button type="button" onClick={onRefresh}>
              Refresh
            </button>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {!isRequests && (
                  <th>
                    <input type="checkbox" aria-label="Select all" />
                  </th>
                )}
                <th>{isRequests ? "REQUEST CODE" : "ORDER CODE"}</th>
                <th>DATE</th>
                <th>{isRequests ? "DESIGN / REQUEST" : "CUSTOMER"}</th>
                <th>{isRequests ? "CUSTOMER WHATSAPP" : "PHONE"}</th>
                {!isRequests && <th>ITEMS</th>}
                <th>{isRequests ? "QUOTED PRICE" : "TOTAL"}</th>
                {!isRequests && <th>PAYMENT</th>}
                <th>STATUS</th>
                {!isRequests && <th>AREA</th>}
                <th>COSTS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => setSelected(o)}
                  style={{ cursor: "pointer" }}
                >
                  {!isRequests && (
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${o.order_code}`}
                      />
                    </td>
                  )}
                  <td>
                    <b>{o.order_code}</b>
                  </td>
                  <td>
                    {new Date(o.created_at).toLocaleDateString(undefined, {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td>
                    {isRequests ? (
                      <div className="request-cell">
                        <strong>{o.customer_name}</strong>
                        <small>
                          {typeof o.selected_design_snapshot === "object" &&
                          o.selected_design_snapshot !== null
                            ? String(
                                (
                                  o.selected_design_snapshot as Record<
                                    string,
                                    unknown
                                  >
                                ).title ??
                                  (
                                    o.selected_design_snapshot as Record<
                                      string,
                                      unknown
                                    >
                                  ).name ??
                                  o.customer_request ??
                                  "Custom request",
                              )
                            : (o.customer_request ??
                              o.order_type.replaceAll("_", " "))}
                        </small>
                      </div>
                    ) : (
                      o.customer_name
                    )}
                  </td>
                  <td>{o.customer_phone ?? "—"}</td>
                  {!isRequests && (
                    <td>
                      {o.order_items?.reduce(
                        (count, item) => count + Number(item.quantity || 0),
                        0,
                      ) ?? 0}
                    </td>
                  )}
                  <td>
                    <strong>
                      {o.total_amount
                        ? `${o.currency_code} ${Number(o.total_amount).toLocaleString()}`
                        : "—"}
                    </strong>
                  </td>
                  {!isRequests && (
                    <td>
                      <Status>{o.payment_status.replaceAll("_", " ")}</Status>
                    </td>
                  )}
                  <td>
                    <select
                      aria-label={`Status for ${o.order_code}`}
                      value={o.status}
                      disabled={busy === o.id}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => void change(o.id, e.target.value)}
                    >
                      {statuses.map((s) => (
                        <option key={s} value={s}>
                          {s.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </td>
                  {!isRequests && <td>{o.delivery_area ?? "—"}</td>}
                  <td>
                    <button
                      className="table-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCostEditing(o);
                      }}
                    >
                      {o.actual_costs_recorded_at ? "Edit" : "Add"}
                    </button>
                  </td>
                  <td>
                    <button
                      className="table-link danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        void removeOrder(o);
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length && (
            <Empty>No {title.toLowerCase()} have been recorded yet.</Empty>
          )}
        </div>
      </section>
      {costEditing && (
        <Modal
          title={`Actual costs · ${costEditing.order_code}`}
          close={() => setCostEditing(null)}
        >
          <form className="admin-form-grid" onSubmit={(e) => void saveCosts(e)}>
            {[
              ["Sourcing", "sourcing", costEditing.actual_sourcing_cost],
              ["Printing", "printing", costEditing.actual_printing_cost],
              ["Delivery", "delivery", costEditing.actual_delivery_cost],
              ["Payment fee", "payment", costEditing.actual_payment_fee],
              ["Other", "other", costEditing.actual_other_cost],
            ].map(([label, key, value]) => (
              <label key={String(key)}>
                {String(label)} (GHS)
                <input
                  name={String(key)}
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={value == null ? "" : String(value)}
                />
              </label>
            ))}
            <label className="admin-check admin-form-wide">
              <input
                type="checkbox"
                name="lock"
                defaultChecked={Boolean(costEditing.cost_locked_at)}
              />
              Lock cost after saving
            </label>
            <div className="admin-form-actions admin-form-wide">
              <button
                type="button"
                className="drawer-secondary"
                onClick={() => setCostEditing(null)}
              >
                Cancel
              </button>
              <button
                className="a-button dark"
                disabled={busy === costEditing.id}
              >
                {busy === costEditing.id ? "Saving…" : "Save actual costs"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {selected &&
        (isRequests ? (
          <RequestQuoteDrawer
            row={selected}
            designs={designs}
            discounts={discounts.filter((d) => d.status === "active")}
            close={() => setSelected(null)}
            say={say}
            onSaved={onRefresh}
          />
        ) : (
          <OrderDetailDrawer
            row={selected}
            close={() => setSelected(null)}
            editCosts={() => {
              setCostEditing(selected);
              setSelected(null);
            }}
            changeStatus={(status) => {
              void change(selected.id, status);
              setSelected({ ...selected, status });
            }}
            busy={busy === selected.id}
          />
        ))}
    </>
  );
}

function DrawerSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="drawer-section">
      <div className="drawer-section-head">
        <h3>{title}</h3>
        {action && <button type="button">{action}</button>}
      </div>
      {children}
    </section>
  );
}
function OrderDetailDrawer({
  row,
  close,
  editCosts,
  changeStatus,
  busy,
}: {
  row: Order;
  close: () => void;
  editCosts: () => void;
  changeStatus: (status: string) => void;
  busy: boolean;
}) {
  const phone = row.customer_phone?.replace(/\D/g, "");
  return (
    <Modal title={row.order_code} close={close}>
      <div className="drawer-status">
        <Status>{row.status.replaceAll("_", " ")}</Status>
        <span>
          {row.payment_status.replaceAll("_", " ")} · GHS{" "}
          {Number(row.amount_paid).toLocaleString()}
        </span>
      </div>
      <DrawerSection title="Customer">
        <div className="customer-card">
          <span>
            {row.customer_name
              .split(" ")
              .map((x) => x[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <div>
            <strong>{row.customer_name}</strong>
            <small>{row.customer_phone ?? "No phone recorded"}</small>
          </div>
          {phone && (
            <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          )}
        </div>
      </DrawerSection>
      <DrawerSection title="Items">
        {row.order_items?.length ? (
          <div className="drawer-items">
            {row.order_items.map((item, index) => (
              <div key={`${row.id}-${index}`}>
                <span>
                  <strong>{item.product_name_snapshot}</strong>
                  <small>
                    Size {item.requested_size ?? "—"} ·{" "}
                    {item.requested_color ?? "—"} · Qty {item.quantity}
                  </small>
                </span>
                <b>
                  GHS{" "}
                  {(
                    Number(item.quoted_unit_price) * Number(item.quantity)
                  ).toLocaleString()}
                </b>
              </div>
            ))}
          </div>
        ) : (
          <p className="admin-empty-state">
            No item details are attached to this order.
          </p>
        )}
      </DrawerSection>
      <DrawerSection title="Delivery">
        <div className="detail-grid">
          <span>
            Area<b>{row.delivery_area ?? "—"}</b>
          </span>
          <span>
            Address<b>{row.delivery_address ?? "—"}</b>
          </span>
          <span>
            Instructions<b>{row.delivery_instructions ?? "—"}</b>
          </span>
          <span>
            Fee<b>GHS {Number(row.delivery_fee ?? 0).toLocaleString()}</b>
          </span>
        </div>
      </DrawerSection>
      <DrawerSection title="Payment">
        <div className="detail-grid">
          <span>
            Amount paid<b>GHS {Number(row.amount_paid).toLocaleString()}</b>
          </span>
          <span>
            Refunded<b>GHS {Number(row.amount_refunded).toLocaleString()}</b>
          </span>
          <span>
            Discount
            <b>GHS {Number(row.discount_amount ?? 0).toLocaleString()}</b>
          </span>
          <span>
            Urgent fee<b>GHS {Number(row.rush_fee ?? 0).toLocaleString()}</b>
          </span>
        </div>
      </DrawerSection>
      <DrawerSection title="Private cost & profit">
        <p>These values are private to the store owner.</p>
        <button className="a-button dark" onClick={editCosts}>
          {row.actual_costs_recorded_at
            ? "Edit actual costs"
            : "Add actual costs"}
        </button>
      </DrawerSection>
      <DrawerSection title="Fulfillment update">
        <label className="drawer-fields">
          Status
          <select
            value={row.status}
            disabled={busy}
            onChange={(e) => changeStatus(e.target.value)}
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </DrawerSection>
      <DrawerSection title="Timeline">
        <div className="vertical-timeline">
          <div>
            <i />
            <span>
              <strong>Order placed</strong>
              <small>{new Date(row.created_at).toLocaleString()}</small>
            </span>
          </div>
          <div>
            <i className="current" />
            <span>
              <strong>{row.status.replaceAll("_", " ")}</strong>
              <small>Current status</small>
            </span>
          </div>
        </div>
      </DrawerSection>
    </Modal>
  );
}
function RequestQuoteDrawer({
  row,
  designs,
  discounts,
  close,
  say,
  onSaved,
}: {
  row: Order;
  designs: GalleryDesign[];
  discounts: Discount[];
  close: () => void;
  say: (message: string) => void;
  onSaved: () => void;
}) {
  const [available, setAvailable] = useState(
    Boolean(row.availability_confirmed_at),
  );
  const [price, setPrice] = useState(String(row.subtotal ?? ""));
  const [delivery, setDelivery] = useState(String(row.delivery_fee ?? ""));
  const [urgent, setUrgent] = useState(String(row.rush_fee ?? ""));
  const [discountId, setDiscountId] = useState(row.discount_id ?? "");
  const [email, setEmail] = useState(row.customer_email ?? "");
  const [busy, setBusy] = useState(false);
  const [proofBusy, setProofBusy] = useState(false);
  const [proofUrl, setProofUrl] = useState("");
  const [customerArtworkUrl, setCustomerArtworkUrl] = useState("");
  const [paymentLink, setPaymentLink] = useState(row.payment_link ?? "");

  // Preview image for the requested design (shown in the request cover so the
  // admin can see which existing design the customer is requesting).
  const designImage = useMemo(() => {
    const snap =
      typeof row.selected_design_snapshot === "object" &&
      row.selected_design_snapshot !== null
        ? (row.selected_design_snapshot as Record<string, unknown>)
        : undefined;
    if (snap?.image) return String(snap.image);
    const name = String(snap?.title ?? snap?.name ?? "");
    if (!name) return "";
    const match = designs.find((d) => String(d.title ?? "") === name);
    if (!match) return "";
    return supabase.storage
      .from("designs")
      .getPublicUrl(match.preview_path || match.image_path).data.publicUrl;
  }, [row.selected_design_snapshot, designs]);

  useEffect(() => {
    let active = true;
    if (row.proof_image_path)
      supabase.storage
        .from("order-proofs")
        .createSignedUrl(row.proof_image_path, 3600)
        .then(({ data }) => {
          if (active) setProofUrl(data?.signedUrl ?? "");
        });
    if (row.customer_artwork_path)
      supabase.storage
        .from("customer-artwork")
        .createSignedUrl(row.customer_artwork_path, 3600)
        .then(({ data }) => {
          if (active) setCustomerArtworkUrl(data?.signedUrl ?? "");
        });
    return () => {
      active = false;
    };
  }, [row.proof_image_path, row.customer_artwork_path]);
  async function uploadProof(file: File | null) {
    if (!file) return;
    if (row.payment_status !== "paid") {
      say(
        "Customer payment must be confirmed before production proofs are uploaded.",
      );
      return;
    }
    if (
      !["image/png", "image/jpeg", "application/pdf"].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    ) {
      say("Proof must be PNG, JPG, or PDF and under 10 MB.");
      return;
    }
    setProofBusy(true);
    const ext =
        file.name
          .split(".")
          .pop()
          ?.replace(/[^a-zA-Z0-9]/g, "") || "file",
      path = `${row.id}/${crypto.randomUUID()}.${ext}`;
    const { data: uploaded, error: uploadError } = await supabase.storage
      .from("order-proofs")
      .upload(path, file, { contentType: file.type });
    if (uploadError) {
      say(uploadError.message);
      setProofBusy(false);
      return;
    }
    const { error } = await supabase
      .from("orders")
      .update({
        proof_image_path: uploaded.path,
        approval_status: "pending",
        status: "proof_sent",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) {
      await supabase.storage.from("order-proofs").remove([uploaded.path]);
      say(error.message);
    } else {
      const { data } = await supabase.storage
        .from("order-proofs")
        .createSignedUrl(uploaded.path, 3600);
      setProofUrl(data?.signedUrl ?? "");
      say("Proof uploaded privately.");
      onSaved();
    }
    setProofBusy(false);
  }
  async function setApproval(approval: "approved" | "revision_requested") {
    const status =
      approval === "approved" ? "proof_approved" : "revision_requested";
    const { error } = await supabase
      .from("orders")
      .update({
        approval_status: approval,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) say(error.message);
    else {
      say(
        approval === "approved"
          ? "Customer proof approval recorded."
          : "Revision requested.",
      );
      onSaved();
    }
  }
  const discount = discounts.find((d) => d.id === discountId);
  const base = Number(price) || 0;
  const discountAmount = discount
    ? Math.min(
        Number(discount.max_cap ?? Infinity),
        discount.type === "percentage"
          ? (base * Number(discount.value)) / 100
          : Number(discount.value),
      )
    : Number(row.discount_amount ?? 0);
  const total = Math.max(
    0,
    base + (Number(delivery) || 0) + (Number(urgent) || 0) - discountAmount,
  );
  async function saveQuote() {
    setBusy(true);
    if (available && discount) {
      const now = new Date();
      if (
        discount.status !== "active" ||
        (discount.start_date && new Date(discount.start_date) > now) ||
        (discount.end_date && new Date(discount.end_date) < now) ||
        base < Number(discount.min_order_amount)
      ) {
        say("This discount is not currently valid for this quote.");
        setBusy(false);
        return false;
      }
      if (
        discount.total_limit !== null &&
        discount.used_count >= discount.total_limit
      ) {
        say("This discount has reached its total use limit.");
        setBusy(false);
        return false;
      }
      if (discount.per_customer_limit && row.customer_phone) {
        const { count, error } = await supabase
          .from("discount_redemptions")
          .select("id", { count: "exact", head: true })
          .eq("discount_id", discount.id)
          .eq("customer_phone", row.customer_phone);
        if (error) {
          say(error.message);
          setBusy(false);
          return false;
        }
        if ((count ?? 0) >= discount.per_customer_limit) {
          say("This customer has reached this discount’s use limit.");
          setBusy(false);
          return false;
        }
      }
    }
    const values = {
      customer_email: email.trim() || null,
      subtotal: base,
      delivery_fee: Number(delivery) || 0,
      rush_fee: Number(urgent) || 0,
      discount_amount: discountAmount,
      discount_id: discount?.id ?? null,
      total_amount: total,
      availability_confirmed_at: available ? new Date().toISOString() : null,
      status: available ? "awaiting_payment" : "alternative_offered",
      payment_status: available ? "awaiting_payment" : row.payment_status,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("orders")
      .update(values)
      .eq("id", row.id);
    if (error) {
      say(error.message);
      setBusy(false);
      return false;
    }
    say(
      available
        ? "Quote saved. Payment can be requested."
        : "Marked unavailable; customer payment is not requested.",
    );
    onSaved();
    setBusy(false);
    return true;
  }
  async function generateLink() {
    if (!available) {
      say("Confirm that the order can be made before requesting payment.");
      return;
    }
    if (!email.trim()) {
      say("Add the customer’s email before creating a Paystack link.");
      return;
    }
    setBusy(true);
    const saved = await saveQuote();
    if (!saved) {
      setBusy(false);
      return;
    }
    const { data, error } = await supabase.functions.invoke(
      "initialize-payment",
      {
        body: {
          orderCode: row.order_code,
          phone: row.customer_phone,
          email: email.trim(),
        },
      },
    );
    if (error || !data?.authorizationUrl) {
      say(error?.message ?? data?.error ?? "Could not create payment link.");
      setBusy(false);
      return;
    }
    const expiry = new Date(Date.now() + 20 * 60 * 1000).toISOString();
    const link = String(data.authorizationUrl);
    const { error: storeError } = await supabase
      .from("orders")
      .update({
        payment_link: link,
        payment_link_expiry: expiry,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (storeError)
      say(`Payment link created but not saved: ${storeError.message}`);
    else {
      setPaymentLink(link);
      say("Paystack payment link is ready.");
      onSaved();
    }
    setBusy(false);
  }
  function sendWhatsApp() {
    if (!row.customer_phone) {
      say("This request has no WhatsApp number.");
      return;
    }
    const message = `Hi ${row.customer_name}, your WearWise quote for ${row.order_code} is ready. Total: GHS ${total.toFixed(2)}.${paymentLink ? ` Pay here: ${paymentLink}` : ""}`;
    window.open(
      `https://wa.me/${row.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }
  const selectedDesign =
    typeof row.selected_design_snapshot === "object" &&
    row.selected_design_snapshot !== null
      ? (row.selected_design_snapshot as Record<string, unknown>)
      : {};
  return (
    <Modal title={row.order_code} close={close}>
      <div className="request-cover">
        {designImage && (
          <img
            src={designImage}
            alt={
              String(
                selectedDesign.title ??
                  selectedDesign.name ??
                  "design",
              ) ?? "design"
            }
          />
        )}
        <div>
          <span>{row.order_type.replaceAll("_", " ")}</span>
          <strong>
            {String(
              selectedDesign.title ??
                selectedDesign.name ??
                "Custom design request",
            )}
          </strong>
        </div>
      </div>
      <DrawerSection title="Request details">
        <div className="detail-grid cols">
          <span>
            Size
            <b>
              {String(
                selectedDesign.size ??
                  row.order_items?.[0]?.requested_size ??
                  "—",
              )}
            </b>
          </span>
          <span>
            Colour
            <b>
              {String(
                selectedDesign.color ??
                  row.order_items?.[0]?.requested_color ??
                  "—",
              )}
            </b>
          </span>
          <span>
            Quantity
            <b>
              {row.order_items?.reduce(
                (sum, item) => sum + Number(item.quantity),
                0,
              ) ?? 1}
            </b>
          </span>
          <span>
            WhatsApp<b>{row.customer_phone ?? "—"}</b>
          </span>
          <span>
            Urgent
            <b className={row.rush_days_early ? "red-text" : ""}>
              {row.rush_days_early
                ? `Yes · ${row.rush_days_early} days earlier`
                : "No"}
            </b>
          </span>
        </div>
        {row.customer_request && (
          <div className="note-box">
            <small>CUSTOMER NOTE</small>
            {row.customer_request}
          </div>
        )}
      </DrawerSection>
      <DrawerSection title="Quote">
        <div className="availability">
          <span>Available to produce?</span>
          <div>
            <button
              type="button"
              className={available ? "active" : ""}
              onClick={() => setAvailable(true)}
            >
              Yes
            </button>
            <button
              type="button"
              className={!available ? "no active" : ""}
              onClick={() => setAvailable(false)}
            >
              No
            </button>
          </div>
        </div>
        <div className="drawer-fields two">
          <label>
            Customer email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Needed for Paystack"
            />
          </label>
          <label>
            Selling price
            <div className="money-input">
              <span>GHS</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </label>
          <label>
            Delivery fee
            <div className="money-input">
              <span>GHS</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={delivery}
                onChange={(e) => setDelivery(e.target.value)}
              />
            </div>
          </label>
          <label>
            Urgent fee
            <div className="money-input">
              <span>GHS</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={urgent}
                onChange={(e) => setUrgent(e.target.value)}
              />
            </div>
          </label>
          <label>
            Discount
            <select
              value={discountId}
              onChange={(e) => setDiscountId(e.target.value)}
            >
              <option value="">No discount</option>
              {discounts
                .filter((d) => d.applies_to !== "shop")
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} ·{" "}
                    {d.type === "percentage" ? `${d.value}%` : `GHS ${d.value}`}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <div className="quote-total">
          <span>Total quoted</span>
          <strong>
            GHS{" "}
            {total.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </strong>
        </div>
        <div className="drawer-fields two">
          <button
            type="button"
            className="a-button lime"
            disabled={busy || !available}
            onClick={() => void generateLink()}
          >
            {busy ? "Preparing…" : "Generate Paystack link"}
          </button>
          <button
            type="button"
            className="a-button light"
            onClick={() => void saveQuote()}
            disabled={busy}
          >
            Save quote
          </button>
        </div>
        {paymentLink && (
          <div className="payment-link">
            <a href={paymentLink} target="_blank" rel="noreferrer">
              Open Paystack link
            </a>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(paymentLink)}
            >
              Copy
            </button>
            <small>
              {row.payment_link_expiry
                ? `Expires ${new Date(row.payment_link_expiry).toLocaleTimeString()}`
                : "Payment link expires after 20 minutes"}
            </small>
          </div>
        )}
        <button type="button" className="a-button light" onClick={sendWhatsApp}>
          Send WhatsApp quote
        </button>
      </DrawerSection>
      <DrawerSection title="Print proof">
        <label className="drop-zone">
          <input
            type="file"
            accept="image/png,image/jpeg,application/pdf"
            disabled={proofBusy || row.payment_status !== "paid"}
            onChange={(e) => void uploadProof(e.target.files?.[0] ?? null)}
          />
          <strong>
            {proofBusy
              ? "Uploading proof…"
              : row.proof_image_path
                ? "Upload a revised proof"
                : "Drop proof here or browse"}
          </strong>
          <small>
            Private upload · PNG, JPG or PDF · up to 10 MB · available after
            payment
          </small>
        </label>
        {proofUrl && (
          <a
            className="table-link"
            href={proofUrl}
            target="_blank"
            rel="noreferrer"
          >
            View current proof
          </a>
        )}
        {row.proof_image_path && (
          <div className="approval-state">
            <Status>{row.approval_status ?? "pending"}</Status>
            <span>Customer review status</span>
          </div>
        )}
        {row.proof_image_path && (
          <div className="drawer-fields two">
            <button
              type="button"
              className="a-button dark"
              onClick={() => void setApproval("approved")}
            >
              Customer approved
            </button>
            <button
              type="button"
              className="a-button light"
              onClick={() => void setApproval("revision_requested")}
            >
              Request revision
            </button>
          </div>
        )}
      </DrawerSection>
      {row.customer_artwork_path && (
        <DrawerSection title="Customer artwork">
          <a
            className="table-link"
            href={customerArtworkUrl}
            target="_blank"
            rel="noreferrer"
          >
            View customer artwork
          </a>
          <small>Private upload · {row.customer_artwork_path}</small>
        </DrawerSection>
      )}
      <DrawerSection title="Locked costs">
        <div className="drawer-fields two">
          <label>
            Actual sourcing cost
            <div className="money-input">
              <span>GHS</span>
              <input value={row.actual_sourcing_cost} readOnly />
            </div>
          </label>
          <label>
            Actual printing cost
            <div className="money-input">
              <span>GHS</span>
              <input value={row.actual_printing_cost} readOnly />
            </div>
          </label>
        </div>
        <button type="button" className="table-link" onClick={close}>
          Use order cost editor
        </button>
      </DrawerSection>
    </Modal>
  );
}

function ShirtTypesPage({
  rows,
  onRefresh,
  say,
}: {
  rows: ShirtType[];
  onRefresh: () => void;
  say: (s: string) => void;
}) {
  const [busy, setBusy] = useState<string | boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    name: string;
    category: string;
    sizes: string;
    colors: string;
    is_active: boolean;
  }>({
    name: "",
    category: "T-shirts",
    sizes: "S, M, L",
    colors: "Black, White",
    is_active: true,
  });
  function parseList(value: string) {
    return value.split(",").map((x) => x.trim()).filter(Boolean);
  }
  async function addShirtType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const sizes = parseList(draft.sizes);
    const colors = parseList(draft.colors);
    if (!draft.name.trim() || sizes.length === 0 || colors.length === 0) {
      say("Name, at least one size and one colour are required.");
      setBusy(false);
      return;
    }
    const { error } = await supabase.from("products").insert({
      name: draft.name.trim(),
      category: draft.category.trim(),
      usual_sizes: sizes,
      usual_colors: colors,
      is_active: draft.is_active,
    });
    setBusy(false);
    if (error) {
      say(error.message);
      return;
    }
    say("Shirt type added.");
    setDraft({
      name: "",
      category: "T-shirts",
      sizes: "S, M, L",
      colors: "Black, White",
      is_active: true,
    });
    onRefresh();
  }
  async function saveShirtType(
    id: string,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setBusy(id);
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const category = String(form.get("category") ?? "").trim();
    const sizes = parseList(String(form.get("sizes") ?? ""));
    const colors = parseList(String(form.get("colors") ?? ""));
    const is_active = form.get("is_active") === "on";
    if (!name || !category || sizes.length === 0 || colors.length === 0) {
      say("Name, category, at least one size and one colour are required.");
      setBusy(false);
      return;
    }
    const { error } = await supabase
      .from("products")
      .update({
        name,
        category,
        usual_sizes: sizes,
        usual_colors: colors,
        is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    setBusy(false);
    if (error) {
      say(error.message);
      return;
    }
    say("Shirt type updated.");
    setEditingId(null);
    onRefresh();
  }
  async function removeShirtType(id: string) {
    if (
      !window.confirm(
        "Remove this shirt type? Customers will no longer be able to request it.",
      )
    )
      return;
    setBusy(id);
    const { error } = await supabase.from("products").delete().eq("id", id);
    setBusy(false);
    if (error) {
      say(error.message);
      return;
    }
    say("Shirt type removed.");
    onRefresh();
  }
  return (
    <div className="a-panel">
      <div className="panel-head">
        <h2>Shirt Types</h2>
        <span>Custom design shirt options (sizes &amp; colours)</span>
      </div>
      <form onSubmit={addShirtType} className="shirt-types-add">
        <div className="form-grid">
          <label className="field">
            <span>Name</span>
            <input
              name="name"
              value={draft.name}
              onChange={(e) =>
                setDraft({ ...draft, name: e.target.value })
              }
            />
          </label>
          <label className="field">
            <span>Category</span>
            <input
              name="category"
              value={draft.category}
              onChange={(e) =>
                setDraft({ ...draft, category: e.target.value })
              }
            />
          </label>
          <label className="field">
            <span>Sizes (comma separated)</span>
            <input
              name="sizes"
              value={draft.sizes}
              onChange={(e) =>
                setDraft({ ...draft, sizes: e.target.value })
              }
            />
          </label>
          <label className="field">
            <span>Colours (comma separated)</span>
            <input
              name="colors"
              value={draft.colors}
              onChange={(e) =>
                setDraft({ ...draft, colors: e.target.value })
              }
            />
          </label>
          <label className="field">
            <label>
              <input
                name="is_active"
                type="checkbox"
                checked={draft.is_active}
                onChange={(e) =>
                  setDraft({ ...draft, is_active: e.target.checked })
                }
              />
              Active
            </label>
          </label>
        </div>
        <button
          type="submit"
          className="a-button dark"
          disabled={busy === true}
        >
          {busy === true ? "Adding…" : "Add shirt type"}
        </button>
      </form>
      <div className="shirt-type-list">
        {rows.length === 0 && (
          <p>No shirt types yet. Add your first one above.</p>
        )}
        {rows.map((t) => {
          const editing = editingId === t.id;
          return (
            <div key={t.id} className="shirt-type-row">
              {editing ? (
                <form onSubmit={(e) => saveShirtType(t.id, e)}>
                  <div className="form-grid">
                    <label className="field">
                      <span>Name</span>
                      <input name="name" defaultValue={t.name} />
                    </label>
                    <label className="field">
                      <span>Category</span>
                      <input
                        name="category"
                        defaultValue={t.category}
                      />
                    </label>
                    <label className="field">
                      <span>Sizes</span>
                      <input
                        name="sizes"
                        defaultValue={t.usual_sizes.join(", ")}
                      />
                    </label>
                    <label className="field">
                      <span>Colours</span>
                      <input
                        name="colors"
                        defaultValue={t.usual_colors.join(", ")}
                      />
                    </label>
                    <label className="field">
                      <label>
                        <input
                          name="is_active"
                          type="checkbox"
                          defaultChecked={t.is_active}
                        />
                        Active
                      </label>
                    </label>
                  </div>
                  <div className="form-actions">
                    <button
                      type="submit"
                      className="a-button dark"
                      disabled={busy === t.id}
                    >
                      {busy === t.id ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      className="a-button outline"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="shirt-type-info">
                    <strong>{t.name}</strong>
                    <span>{t.category}</span>
                    <span className="sizes">
                      Sizes: {t.usual_sizes.join(", ")}
                    </span>
                    <span className="colors">
                      Colours: {t.usual_colors.join(", ")}
                    </span>
                    <span className={`status ${t.is_active ? "active" : ""}`}>
                      {t.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="shirt-type-actions">
                    <button
                      type="button"
                      className="a-button outline"
                      onClick={() => setEditingId(t.id)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="a-button outline"
                      onClick={() => removeShirtType(t.id)}
                    >
                      Remove
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
function ProductsPage({
  rows,
  variants,
  designs,
  categories,
  onRefresh,
  say,
}: {
  rows: StoreItem[];
  variants: ProductVariant[];
  designs: GalleryDesign[];
  categories: Category[];
  onRefresh: () => void;
  onCatalogRefresh: () => void;
  say: (s: string) => void;
}) {
  const [editing, setEditing] = useState<StoreItem | null | false>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("Shop Products");
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<VariantDraft[]>([]);
  const [sizes, setSizes] = useState("S, M, L");
  const [colors, setColors] = useState("Black");
  const [globalSellingPrice, setGlobalSellingPrice] = useState("");
  const [globalCostPrice, setGlobalCostPrice] = useState("");
  const [globalStock, setGlobalStock] = useState("10");
  const [imagePathsToDelete, setImagePathsToDelete] = useState<string[]>([]);
  // colorImageMap[i] = colour assigned to image_paths[i] (magnet pairing).
  // Keeps colours and images aligned: reordering one reorders the other.
  const [colorImageMap, setColorImageMap] = useState<string[]>([]);
  // orderedImagePaths controls the visual + save order of images (magnet pairing
  // with colorImageMap). Reordering here moves colours along with images.
  const [orderedImagePaths, setOrderedImagePaths] = useState<string[]>([]);
  // orderedSizeOptions preserves the user's preferred size order across edits.
  const [orderedSizeOptions, setOrderedSizeOptions] = useState<string[]>([]);
  const current = editing && typeof editing === "object" ? editing : null;
  const visible = rows.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.category.toLowerCase().includes(search.toLowerCase()),
  );
  function openEditor(item: StoreItem | null = null) {
    if (item) {
      const saved = variants.filter((v) => v.product_id === item.id);
      const sizeList = [...new Set(saved.map((v) => v.size))].join(", ");
      const colorList = [...new Set(saved.map((v) => v.color))].join(", ");
      const first = saved[0];
      setSizes(sizeList);
      setColors(colorList);
      setGlobalSellingPrice(first ? String(first.selling_price) : String(item.price));
      setGlobalCostPrice(first && first.cost_price != null ? String(first.cost_price) : "");
      setGlobalStock(saved.length ? String(saved[0].stock) : String(item.stock_quantity ?? 0));
      setDrafts(
        saved.length
          ? saved.map((v) => ({
              size: v.size,
              color: v.color,
              stock: String(v.stock),
              selling_price: String(v.selling_price),
              cost_price: v.cost_price == null ? "" : String(v.cost_price),
            }))
          : item.size_options.map((size) => ({
              size,
              color: item.color_options[0] ?? "",
              stock: String(item.stock_quantity ?? 0),
              selling_price: String(item.price),
              cost_price: String(item.purchase_cost ?? ""),
            })),
      );
      // Initialize colour-image magnet map: pair each image with a colour.
      // If fewer colours than images, repeat the last colour; if more colours
      // than images, truncate to image count.
      const existingColors = item.color_options ?? [];
      const existingImages = item.image_paths ?? [];
      const initMap: string[] = [];
      for (let i = 0; i < existingImages.length; i++) {
        initMap.push(existingColors[i] ?? existingColors[existingColors.length - 1] ?? "");
      }
      setColorImageMap(initMap);
      setOrderedImagePaths([...existingImages]);
      // Merge colours from variants with the colour-image map so the text
      // input reflects ALL colours (no stale deleted / missing new ones).
      const variantColors = [...new Set(saved.map((v) => v.color.trim()))];
      const mapColors = [...new Set(initMap.filter((c) => c.trim()))];
      const allColors = [...new Set([...variantColors, ...mapColors])];
      setColors(allColors.join(", "));
      // Initialize size order from the product's existing size_options.
      const existingSizes = item.size_options ?? [];
      setOrderedSizeOptions([...existingSizes]);
    } else {
      setSizes("S, M, L");
      setColors("Black");
      setGlobalSellingPrice("");
      setGlobalCostPrice("");
      setGlobalStock("10");
      setColorImageMap([]);
      setOrderedSizeOptions([]);
      setOrderedImagePaths([]);
      setDrafts([
        {
          size: "S",
          color: "Black",
          stock: "10",
          selling_price: "",
          cost_price: "",
        },
        {
          size: "M",
          color: "Black",
          stock: "10",
          selling_price: "",
          cost_price: "",
        },
        {
          size: "L",
          color: "Black",
          stock: "10",
          selling_price: "",
          cost_price: "",
        },
      ]);
    }
    setEditing(item ?? false);
  }
  async function toggleDesign(design: GalleryDesign) {
    const { error } = await supabase
      .from("designs")
      .update({ published: !design.published })
      .eq("id", design.id);
    if (error) say(error.message);
    else {
      say("Design visibility updated.");
      onRefresh();
    }
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const id = editing && typeof editing === "object" ? editing.id : null;
    const name = String(f.get("name") ?? "").trim(),
      category = String(f.get("category") ?? "").trim();
    const validVariants = drafts.filter((v) => v.size.trim() && v.color.trim());
    const price = Number(validVariants[0]?.selling_price),
      stock = validVariants.reduce((sum, v) => sum + Number(v.stock || 0), 0);
    // Use the user-arranged order (orderedImagePaths) when editing, falling
    // back to the stored image_paths for brand-new items.
    const existingPaths =
      orderedImagePaths.length > 0
        ? [...orderedImagePaths]
        : editing && typeof editing === "object"
          ? [...editing.image_paths]
          : [];
    const pathsToKeep = existingPaths.filter((p) => !imagePathsToDelete.includes(p));
    if (imagePathsToDelete.length) {
      const { error: delError } = await supabase.storage
        .from("store-items")
        .remove(imagePathsToDelete);
      if (delError) {
        say(`Could not remove image(s): ${delError.message}`);
        setBusy(false);
        return;
      }
    }
    const paths = [...pathsToKeep];
    // Build colour map aligned with final image order (magnet pairing).
    // Always derive from the per-image colour map so changes made in admin
    // (new/removed/rearranged colours) reflect correctly on the client side.
    const finalColorMap = [...colorImageMap];
    // Ensure every image has a colour slot (pad if needed), but NEVER trim
    // — colours added via the text input for which no image exists yet must
    // still appear on the client side (they fall back to the active image).
    while (finalColorMap.length < pathsToKeep.length) finalColorMap.push("");
    for (const file of f
      .getAll("photos")
      .filter((v): v is File => v instanceof File && v.size > 0)) {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 5 * 1024 * 1024
      ) {
        say("Photos must be JPEG, PNG, or WebP and under 5 MB.");
        setBusy(false);
        return;
      }
      const path = `products/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { data: uploaded, error } = await supabase.storage
        .from("store-items")
        .upload(path, file, { contentType: file.type });
      if (error) {
        say(error.message);
        setBusy(false);
        return;
      }
      paths.push(uploaded.path);
      finalColorMap.push("");
    }
    if (
      !name ||
      !category ||
      !validVariants.length ||
      !Number.isFinite(price) ||
      price <= 0 ||
      validVariants.some(
        (v) =>
          !Number.isInteger(Number(v.stock)) ||
          Number(v.stock) < 0 ||
          !Number.isFinite(Number(v.selling_price)) ||
          Number(v.selling_price) <= 0 ||
          (v.cost_price !== "" &&
            (!Number.isFinite(Number(v.cost_price)) ||
              Number(v.cost_price) < 0)),
      )
    ) {
      say(
        "Add at least one valid size and colour variant with stock and selling price.",
      );
      setBusy(false);
      return;
    }
    const values = {
      name,
      category,
      category_id:
        categories.find((c) => c.name.toLowerCase() === category.toLowerCase())
          ?.id ?? null,
      description: String(f.get("description") ?? "").trim(),
      price,
      currency_code: "GHS",
      image_paths: paths,
      // Preserve the user's arranged size order (never shuffle on edit/reload).
      size_options:
        orderedSizeOptions.length > 0
          ? [...orderedSizeOptions.filter((s) => s.trim())]
          : [...new Set(validVariants.map((v) => v.size.trim()))],
      // colour_options aligned with image_paths (magnet pairing): unique colours
      // from the per-image colour map, in image order.
      color_options: [...new Set(finalColorMap.filter((c) => c.trim()))],
      is_available: f.get("available") === "on",
      is_published: f.get("published") === "on",
      stock_quantity: stock,
      updated_at: new Date().toISOString(),
    };
    const result = id
      ? await supabase
          .from("store_items")
          .update(values)
          .eq("id", id)
          .select("id")
          .single()
      : await supabase.from("store_items").insert(values).select("id").single();
    if (result.error || !result.data) {
      say(result.error?.message ?? "Could not save product.");
      setBusy(false);
      return;
    }
    const productId = result.data.id;
    const { error: archiveError } = await supabase
      .from("product_variants")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("product_id", productId);
    if (archiveError) {
      say(
        `Product saved, but variants could not be updated: ${archiveError.message}`,
      );
      setBusy(false);
      return;
    }
    const { data: savedVariants, error: variantError } = await supabase
      .from("product_variants")
      .upsert(
        validVariants.map((v) => ({
          product_id: productId,
          size: v.size.trim(),
          color: v.color.trim(),
          stock: Number(v.stock),
          selling_price: Number(v.selling_price),
          status: "active",
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "product_id,size,color" },
      )
      .select("id,size,color");
    if (variantError) {
      say(
        `Product saved, but variants could not be saved: ${variantError.message}`,
      );
      setBusy(false);
      return;
    }
    const costRows = (savedVariants ?? []).flatMap((v) => {
      const draft = validVariants.find(
        (row) => row.size.trim() === v.size && row.color.trim() === v.color,
      );
      return draft && draft.cost_price !== ""
        ? [
            {
              variant_id: v.id,
              cost_price: Number(draft.cost_price),
              updated_at: new Date().toISOString(),
            },
          ]
        : [];
    });
    if (costRows.length) {
      const { error: variantCostError } = await supabase
        .from("product_variant_costs")
        .upsert(costRows, { onConflict: "variant_id" });
      if (variantCostError) {
        say(
          `Product saved, but private variant cost could not be saved: ${variantCostError.message}`,
        );
        setBusy(false);
        return;
      }
    }
    const { error: costError } = await supabase.from("store_item_costs").upsert(
      {
        store_item_id: productId,
        purchase_cost: null,
        other_cost: f.get("other_cost") ? Number(f.get("other_cost")) : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "store_item_id" },
    );
    if (costError)
      say(`Product saved, cost could not be saved: ${costError.message}`);
    else say(id ? "Product updated." : "Product added.");
    setEditing(null);
    setImagePathsToDelete([]);
    setOrderedImagePaths([]);
    setColorImageMap([]);
    setOrderedSizeOptions([]);
    setBusy(false);
    onRefresh();
  }
  async function toggle(row: StoreItem, key: "is_available" | "is_published") {
    const { error } = await supabase
      .from("store_items")
      .update({ [key]: !row[key], updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) say(error.message);
    else {
      say("Product status updated.");
      onRefresh();
    }
  }
  async function removeProduct(row: StoreItem) {
    if (!window.confirm(`Delete ${row.name}? This cannot be undone.`)) return;
    const { error } = await supabase
      .from("store_items")
      .delete()
      .eq("id", row.id);
    if (error) say(`Could not delete product: ${error.message}`);
    else {
      say("Product deleted.");
      onRefresh();
    }
  }
  return (
    <>
      <PageHead
        eyebrow="CATALOGUE"
        title="Products"
        action={tab === "Shop Products" ? "+ Add product" : undefined}
        onAction={() => openEditor()}
      />
      <div className="admin-tabs simple">
        {["Shop Products", "Explore Designs"].map((x) => (
          <button
            className={tab === x ? "active" : ""}
            onClick={() => setTab(x)}
            key={x}
          >
            {x}
          </button>
        ))}
      </div>
      <section className="a-panel table-panel">
        <div className="bulk-bar">
          <span>
            {tab}{" "}
            <b>{tab === "Shop Products" ? visible.length : designs.length}</b>
          </span>
          <label className="a-search">
            ⌕
            <input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <div className="table-scroll">
          {tab === "Shop Products" ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" aria-label="Select all products" />
                  </th>
                  <th>PRODUCT</th>
                  <th>CATEGORY</th>
                  <th>SELLING PRICE</th>
                  <th>COST PRICE</th>
                  <th>STOCK</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <input type="checkbox" aria-label={`Select ${r.name}`} />
                    </td>
                    <td>
                      <div className="item-cell">
                        {r.image_paths?.[0] && (
                          <img
                            src={
                              supabase.storage
                                .from("store-items")
                                .getPublicUrl(r.image_paths[0]).data.publicUrl
                            }
                            alt=""
                          />
                        )}
                        <strong>{r.name}</strong>
                      </div>
                    </td>
                    <td>{r.category}</td>
                    <td>
                      <strong>GHS {Number(r.price).toLocaleString()}</strong>
                    </td>
                    <td className="muted">
                      {r.purchase_cost == null
                        ? "—"
                        : `GHS ${Number(r.purchase_cost).toLocaleString()}`}
                    </td>
                    <td>
                      <b
                        className={
                          r.stock_quantity !== null && r.stock_quantity < 5
                            ? "stock-alert"
                            : ""
                        }
                      >
                        {r.stock_quantity ?? "—"}
                      </b>
                    </td>
                    <td>
                      <Status>
                        {!r.is_available
                          ? "Unavailable"
                          : r.is_published
                            ? "Active"
                            : "Hidden"}
                      </Status>
                    </td>
                    <td>
                      <button
                        className="more-button"
                        onClick={() => openEditor(r)}
                      >
                        •••
                      </button>
                      <button
                        className="table-link danger"
                        onClick={() => void removeProduct(r)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>DESIGN</th>
                  <th>CODE</th>
                  <th>CATEGORY</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {designs
                  .filter(
                    (d) =>
                      (d.title ?? "WearWise Design")
                        .toLowerCase()
                        .includes(search.toLowerCase()) ||
                      d.category.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((d) => (
                    <tr key={d.id}>
                      <td>
                        <div className="item-cell">
                          <img
                            src={
                              supabase.storage
                                .from("designs")
                                .getPublicUrl(d.preview_path || d.image_path)
                                .data.publicUrl
                            }
                            alt=""
                          />
                          <strong>{d.title || "WearWise Design"}</strong>
                        </div>
                      </td>
                      <td>
                        <code>{d.id.slice(0, 8).toUpperCase()}</code>
                      </td>
                      <td>{d.category}</td>
                      <td>
                        <Status>{d.published ? "Active" : "Hidden"}</Status>
                      </td>
                      <td>
                        <button
                          className="table-link"
                          onClick={() => void toggleDesign(d)}
                        >
                          {d.published ? "Hide" : "Publish"}
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
          {tab === "Shop Products" && !visible.length && (
            <Empty>No shop items yet. Add your first item.</Empty>
          )}
          {tab === "Explore Designs" && !designs.length && (
            <Empty>No gallery designs found.</Empty>
          )}
        </div>
      </section>
      {editing !== null && (
        <Modal
          title={editing ? "Edit shop item" : "Add shop item"}
          close={() => setEditing(null)}
        >
          <form className="admin-form-grid" onSubmit={(e) => void save(e)}>
            <label>
              Product name
              <input
                name="name"
                required
                defaultValue={current ? current.name : ""}
              />
            </label>
            <label>
              Category
              {categories.some((c) => c.status === "active") ? (
                <select
                  name="category"
                  required
                  defaultValue={
                    current
                      ? current.category
                      : categories.find((c) => c.status === "active")?.name
                  }
                >
                  {categories
                    .filter((c) => c.status === "active")
                    .map((c) => (
                      <option key={c.id}>{c.name}</option>
                    ))}
                </select>
              ) : (
                <input
                  name="category"
                  required
                  defaultValue={current ? current.category : ""}
                  placeholder="Add a category below first"
                />
              )}
            </label>
            <input
              type="hidden"
              name="price"
              value={drafts[0]?.selling_price ?? current?.price ?? ""}
            />
            <label className="admin-form-wide">
              Other costs (private, GHS)
              <input
                name="other_cost"
                type="number"
                min="0"
                step="0.01"
                defaultValue={current?.other_cost ?? ""}
              />
            </label>
            <div className="admin-form-wide">
              <div className="drawer-section-head">
                <h3>Variants builder</h3>
              </div>
              <div className="variant-grid">
                <label>
                  Sizes (comma separated)
                  <input
                    aria-label="Variant sizes"
                    value={sizes}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSizes(value);
                      // Sync orderedSizeOptions with the sizes text input so
                      // the saved order never shuffles on edit/reload.
                      const sizeList = value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
                      const currentSizes = orderedSizeOptions.filter((s) => s.trim());
                      const newSizes = sizeList.filter((s) => !currentSizes.includes(s));
                      const deletedSizes = currentSizes.filter((s) => !sizeList.includes(s));
                      let next = orderedSizeOptions.filter((s) => !deletedSizes.includes(s));
                      newSizes.forEach((s) => {
                        if (!next.includes(s)) next.push(s);
                      });
                      setOrderedSizeOptions(next);
                    }}
                    placeholder="e.g. S, M, L, XL"
                  />
                </label>
                <label>
                  Colours (comma separated)
                  <input
                    aria-label="Variant colours"
                    value={colors}
                    onChange={(e) => {
                      const value = e.target.value;
                      setColors(value);
                      // Sync colorImageMap with the colours text input:
                      // add new colours, blank out deleted ones. Each image
                      // keeps its paired colour; surplus colours are appended.
                      const colorList = value
                        .split(",")
                        .map((c) => c.trim())
                        .filter(Boolean);
                      const currentUnique = [...new Set(colorImageMap.filter((c) => c.trim()))];
                      const newColors = colorList.filter((c) => !currentUnique.includes(c));
                      const deletedColors = currentUnique.filter((c) => !colorList.includes(c));
                      let next = colorImageMap.map((c) =>
                        deletedColors.includes(c) ? "" : c,
                      );
                      newColors.forEach((c) => {
                        const emptyIdx = next.findIndex((x) => !x.trim());
                        if (emptyIdx >= 0) next[emptyIdx] = c;
                        else next.push(c);
                      });
                      setColorImageMap(next);
                    }}
                    placeholder="e.g. Black, White, Red"
                  />
                </label>
                <label>
                  Selling price (GHS)
                  <input
                    aria-label="Global selling price"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={globalSellingPrice}
                    onChange={(e) => setGlobalSellingPrice(e.target.value)}
                  />
                </label>
                <label>
                  Cost price (GHS)
                  <input
                    aria-label="Global cost price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={globalCostPrice}
                    onChange={(e) => setGlobalCostPrice(e.target.value)}
                  />
                </label>
                <label>
                  Stock per variant
                  <input
                    aria-label="Global stock"
                    type="number"
                    min="0"
                    value={globalStock}
                    onChange={(e) => setGlobalStock(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="a-button dark"
                  onClick={() => {
                    const sizeList = sizes
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    const colorList = colors
                      .split(",")
                      .map((c) => c.trim())
                      .filter(Boolean);
                    if (!sizeList.length || !colorList.length) {
                      say("Enter at least one size and one colour.");
                      return;
                    }
                    setDrafts(
                      sizeList.flatMap((size) =>
                        colorList.map((color) => ({
                          size,
                          color,
                          stock: globalStock,
                          selling_price: globalSellingPrice,
                          cost_price: globalCostPrice,
                        })),
                      ),
                    );
                    // Sync the per-image colour map with the entered colours
                    // so every colour can be assigned to an image position.
                    if (orderedImagePaths.length > 0) {
                      const next = colorList.slice(0, orderedImagePaths.length).map(
                        (c, i) => colorImageMap[i]?.trim() || c,
                      );
                      setColorImageMap(next);
                    } else {
                      setColorImageMap([...colorList]);
                    }
                    setColors(colorList.join(", "));
                  }}
                >
                  Generate variants
                </button>
              </div>
              {drafts.length > 0 && (
                <div className="variant-preview">
                  <table className="variant-table">
                    <thead>
                      <tr>
                        <th>SIZE</th>
                        <th>COLOUR</th>
                        <th>STOCK</th>
                        <th>SELLING</th>
                        <th>COST</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {drafts.map((v, index) => (
                        <tr key={index}>
                          <td>{v.size}</td>
                          <td>{v.color}</td>
                          <td>{v.stock}</td>
                          <td>{v.selling_price}</td>
                          <td>{v.cost_price}</td>
                          <td>
                            <button
                              type="button"
                              onClick={() =>
                                setDrafts(drafts.filter((_, i) => i !== index))
                              }
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="variant-hint">
                    {drafts.length} variant(s) will be created.
                  </p>
                </div>
              )}
            </div>
            <label className="admin-form-wide">
              Description
              <textarea
                name="description"
                rows={3}
                defaultValue={current?.description ?? ""}
              />
            </label>
            <label className="admin-form-wide">
              Photos (JPEG, PNG, WebP · max 5 MB each)
              <p className="photo-hint" style={{ marginTop: 4, fontSize: 11, color: "#6e726b" }}>
                Each image is paired with a colour (magnet). Reordering images
                moves their colours with them. On the product page, tapping a
                colour shows its paired image.
              </p>
              {orderedImagePaths.length > 0 && (
                <div className="photo-gallery" style={{ marginTop: 8 }}>
                  {orderedImagePaths.map((path, i) => {
                    const imgColor = colorImageMap[i] ?? "";
                    return (
                      <div key={i} className="photo-item">
                        <img
                          src={`https://qavvobfskuhebepnglhh.supabase.co/storage/v1/object/public/store-items/${path}`}
                          alt={`Product photo ${i + 1}`}
                          className="photo-thumb"
                        />
                        <div className="photo-controls">
                          <input
                            type="text"
                            placeholder="Colour"
                            value={imgColor}
                            onChange={(e) => {
                              const next = [...colorImageMap];
                              next[i] = e.target.value.trim();
                              setColorImageMap(next);
                              // Sync the colours text input so variants stay
                              // consistent with the per-image colour map.
                              const uniqueColors = [...new Set(next.filter((c) => c.trim()))];
                              setColors(uniqueColors.join(", "));
                            }}
                            className="photo-color-input"
                          />
                          <button
                            type="button"
                            className="photo-move photo-move-up"
                            disabled={i === 0}
                            onClick={() => {
                              const nextPaths = [...orderedImagePaths];
                              const nextColors = [...colorImageMap];
                              [nextPaths[i - 1], nextPaths[i]] = [nextPaths[i], nextPaths[i - 1]];
                              [nextColors[i - 1], nextColors[i]] = [nextColors[i], nextColors[i - 1]];
                              setOrderedImagePaths(nextPaths);
                              setColorImageMap(nextColors);
                              setColors([...new Set(nextColors.filter((c) => c.trim()))].join(", "));
                            }}
                            aria-label="Move image up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="photo-move photo-move-down"
                            disabled={i === orderedImagePaths.length - 1}
                            onClick={() => {
                              const nextPaths = [...orderedImagePaths];
                              const nextColors = [...colorImageMap];
                              [nextPaths[i + 1], nextPaths[i]] = [nextPaths[i], nextPaths[i + 1]];
                              [nextColors[i + 1], nextColors[i]] = [nextColors[i], nextColors[i + 1]];
                              setOrderedImagePaths(nextPaths);
                              setColorImageMap(nextColors);
                              setColors([...new Set(nextColors.filter((c) => c.trim()))].join(", "));
                            }}
                            aria-label="Move image down"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="photo-remove"
                            onClick={() => {
                              setImagePathsToDelete([...imagePathsToDelete, path]);
                              const nextPaths = orderedImagePaths.filter((_, idx) => idx !== i);
                              const nextColors = colorImageMap.filter((_, idx) => idx !== i);
                              setOrderedImagePaths(nextPaths);
                              setColorImageMap(nextColors);
                              setColors([...new Set(nextColors.filter((c) => c.trim()))].join(", "));
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {imagePathsToDelete.length > 0 && (
                    <p className="photo-hint">
                      {imagePathsToDelete.length} image(s) marked for removal.
                    </p>
                  )}
                </div>
              )}
              <input
                name="photos"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
              />
            </label>
            <label className="admin-check">
              <input
                name="available"
                type="checkbox"
                defaultChecked={current ? current.is_available : true}
              />{" "}
              Available
            </label>
            <label className="admin-check">
              <input
                name="published"
                type="checkbox"
                defaultChecked={current ? current.is_published : false}
              />{" "}
              Published in shop
            </label>
            <div className="admin-form-actions admin-form-wide">
              <button
                type="button"
                className="drawer-secondary"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button className="a-button dark" disabled={busy}>
                {busy ? "Saving…" : "Save item"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function CategoriesPage({
  rows,
  products,
  onRefresh,
  say,
}: {
  rows: Category[];
  products: StoreItem[];
  onRefresh: () => void;
  say: (s: string) => void;
}) {
  const [editing, setEditing] = useState<Category | null | false>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const current = editing && typeof editing === "object" ? editing : null;
  const visible = rows.filter((row) =>
    `${row.name} ${row.slug}`.toLowerCase().includes(search.toLowerCase()),
  );
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget),
      id = editing && typeof editing === "object" ? editing.id : null;
    let imageUrl = String(f.get("image_url") ?? "").trim() || null;
    const file = f.get("category_photo");
    if (file instanceof File && file.size) {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 5 * 1024 * 1024
      ) {
        say("Category image must be JPEG, PNG, or WebP and under 5 MB.");
        setBusy(false);
        return;
      }
      const path = `categories/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { data: uploaded, error } = await supabase.storage
        .from("store-items")
        .upload(path, file, { contentType: file.type });
      if (error) {
        say(error.message);
        setBusy(false);
        return;
      }
      imageUrl = supabase.storage
        .from("store-items")
        .getPublicUrl(uploaded.path).data.publicUrl;
    }
    const values = {
      name: String(f.get("name") ?? "").trim(),
      slug: String(f.get("slug") ?? "")
        .trim()
        .toLowerCase(),
      description: String(f.get("description") ?? "").trim(),
      image_url: imageUrl,
      status: String(f.get("status") ?? "active"),
      updated_at: new Date().toISOString(),
    };
    const result = id
      ? await supabase.from("categories").update(values).eq("id", id)
      : await supabase.from("categories").insert(values);
    if (result.error) say(result.error.message);
    else {
      say("Category saved.");
      setEditing(null);
      onRefresh();
    }
    setBusy(false);
  }
  async function archive(row: Category) {
    const { error } = await supabase
      .from("categories")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) say(error.message);
    else {
      say("Category archived.");
      onRefresh();
    }
  }
  async function remove(row: Category) {
    if (!window.confirm(`Delete ${row.name}? This cannot be undone.`)) return;
    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", row.id);
    if (error) say(`Could not delete category: ${error.message}`);
    else {
      say("Category deleted.");
      onRefresh();
    }
  }
  return (
    <>
      <PageHead
        eyebrow="CATALOGUE"
        title="Categories"
        action="+ Add category"
        onAction={() => setEditing(false)}
      />
      <section className="a-panel table-panel">
        <div className="bulk-bar">
          <span>
            Categories <b>{rows.length}</b>
          </span>
          <label className="a-search">
            ⌕
            <input
              placeholder="Search categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>CATEGORY</th>
                <th>PRODUCT COUNT</th>
                <th>STATUS</th>
                <th>LAST UPDATED</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="category-cell">
                      {r.image_url ? (
                        <img src={r.image_url} alt="" />
                      ) : (
                        <span>{r.name.slice(0, 2).toUpperCase()}</span>
                      )}
                      <strong>{r.name}</strong>
                    </div>
                  </td>
                  <td>
                    {
                      products.filter(
                        (p) =>
                          p.category.toLowerCase() === r.name.toLowerCase(),
                      ).length
                    }{" "}
                    products
                  </td>
                  <td>
                    <Status>
                      {r.status === "active"
                        ? "Active"
                        : r.status === "hidden"
                          ? "Hidden"
                          : "Archived"}
                    </Status>
                  </td>
                  <td>{new Date(r.created_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      className="table-link"
                      onClick={() => setEditing(r)}
                    >
                      Edit
                    </button>
                    {r.status !== "archived" && (
                      <button
                        className="table-link muted"
                        onClick={() => void archive(r)}
                      >
                        Archive
                      </button>
                    )}
                    <button
                      className="table-link danger"
                      onClick={() => void remove(r)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <Empty>
              No categories yet. Add one to organize store products.
            </Empty>
          )}
        </div>
      </section>
      {editing !== null && (
        <Modal
          title={editing ? "Edit category" : "Add category"}
          close={() => setEditing(null)}
        >
          <form className="admin-form-grid" onSubmit={(e) => void save(e)}>
            <label>
              Name
              <input
                required
                name="name"
                defaultValue={current ? current.name : ""}
              />
            </label>
            <label>
              Slug
              <input
                required
                name="slug"
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                placeholder="t-shirts"
                defaultValue={current ? current.slug : ""}
              />
            </label>
            <label className="admin-form-wide">
              Description
              <textarea
                name="description"
                rows={3}
                defaultValue={current?.description ?? ""}
              />
            </label>
            <label className="admin-form-wide">
              Image URL (optional)
              <input
                name="image_url"
                type="url"
                defaultValue={current?.image_url ?? ""}
              />
            </label>
            <label className="drop-zone admin-form-wide">
              <input
                name="category_photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
              />
              <strong>Upload category image</strong>
              <small>JPEG, PNG or WebP · max 5 MB</small>
            </label>
            <label>
              Status
              <select name="status" defaultValue={current?.status ?? "active"}>
                <option value="active">Active</option>
                <option value="hidden">Hidden</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <div className="admin-form-actions admin-form-wide">
              <button
                type="button"
                className="drawer-secondary"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button className="a-button dark" disabled={busy}>
                {busy ? "Saving…" : "Save category"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function DiscountsPage({
  rows,
  onRefresh,
  onSaved,
  say,
}: {
  rows: Discount[];
  onRefresh: () => void;
  onSaved: (discount: Discount) => void;
  say: (s: string) => void;
}) {
  const [editing, setEditing] = useState<Discount | null | false>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const current = editing && typeof editing === "object" ? editing : null;
  const visible = rows.filter(
    (r) =>
      (filter === "all" || r.status === filter) &&
      `${r.code} ${r.applies_to}`.toLowerCase().includes(search.toLowerCase()),
  );
  const statusLabel = (r: Discount) =>
    r.status === "active" && r.end_date && new Date(r.end_date) < new Date()
      ? "Expired"
      : r.status === "active" &&
          r.start_date &&
          new Date(r.start_date) > new Date()
        ? "Scheduled"
        : r.status[0].toUpperCase() + r.status.slice(1);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget),
      id = editing && typeof editing === "object" ? editing.id : null;
    const number = (k: string) =>
      String(f.get(k) ?? "").trim() ? Number(f.get(k)) : null;
    const values = {
      code: String(f.get("code") ?? "")
        .trim()
        .toUpperCase(),
      type: String(f.get("type")),
      value: number("value"),
      max_cap: number("max_cap"),
      start_date: String(f.get("start_date") ?? "") || null,
      end_date: String(f.get("end_date") ?? "") || null,
      total_limit: number("total_limit"),
      per_customer_limit: number("per_customer_limit"),
      min_order_amount: number("min_order_amount") ?? 0,
      applies_to: String(f.get("applies_to")),
      status: String(f.get("status")),
      updated_at: new Date().toISOString(),
    };
    if (
      values.value === null ||
      values.value <= 0 ||
      (values.type === "percentage" && values.value > 100)
    ) {
      say(
        "Enter a valid discount value. Percentage values must be 100 or lower.",
      );
      setBusy(false);
      return;
    }
    const result = id
      ? await supabase
          .from("discounts")
          .update(values)
          .eq("id", id)
          .select(
            "id,code,type,value,max_cap,start_date,end_date,total_limit,per_customer_limit,min_order_amount,applies_to,status,used_count",
          )
          .single()
      : await supabase
          .from("discounts")
          .insert(values)
          .select(
            "id,code,type,value,max_cap,start_date,end_date,total_limit,per_customer_limit,min_order_amount,applies_to,status,used_count",
          )
          .single();
    if (result.error || !result.data)
      say(
        result.error?.message ?? "Discount was saved but could not be loaded.",
      );
    else {
      say("Discount saved.");
      onSaved(result.data as Discount);
      setEditing(null);
      onRefresh();
    }
    setBusy(false);
  }
  async function archive(row: Discount) {
    const { error } = await supabase
      .from("discounts")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) say(error.message);
    else {
      say("Discount archived.");
      onRefresh();
    }
  }
  async function remove(row: Discount) {
    if (!window.confirm(`Delete discount ${row.code}? This cannot be undone.`))
      return;
    const { error } = await supabase
      .from("discounts")
      .delete()
      .eq("id", row.id);
    if (error) say(`Could not delete discount: ${error.message}`);
    else {
      say("Discount deleted.");
      onRefresh();
    }
  }
  return (
    <>
      <PageHead
        eyebrow="MARKETING"
        title="Discounts"
        action="+ Create discount"
        onAction={() => setEditing(false)}
      />
      <section className="a-panel table-panel">
        <div className="bulk-bar">
          <span>
            All discounts <b>{rows.length}</b>
          </span>
          <label className="a-search">
            ⌕
            <input
              placeholder="Search discounts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>CODE</th>
                <th>TYPE</th>
                <th>VALUE</th>
                <th>USED / LIMIT</th>
                <th>PERIOD</th>
                <th>APPLIES TO</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} onClick={() => setEditing(r)}>
                  <td>
                    <code>{r.code}</code>
                  </td>
                  <td>
                    <Status tone="gray">
                      {r.type === "percentage" ? "Percentage" : "Fixed"}
                    </Status>
                  </td>
                  <td>
                    <strong>
                      {r.type === "percentage"
                        ? `${r.value}%`
                        : `GHS ${r.value}`}
                    </strong>
                  </td>
                  <td>
                    <div className="usage">
                      <span>
                        <i
                          style={{
                            width: `${r.total_limit ? Math.min(100, (Number(r.used_count) / r.total_limit) * 100) : 0}%`,
                          }}
                        />
                      </span>
                      <small>
                        {r.used_count} / {r.total_limit ?? "∞"}
                      </small>
                    </div>
                  </td>
                  <td>
                    {r.start_date
                      ? new Date(r.start_date).toLocaleDateString()
                      : "Now"}{" "}
                    –{" "}
                    {r.end_date
                      ? new Date(r.end_date).toLocaleDateString()
                      : "No expiry"}
                  </td>
                  <td>
                    <Status tone="gray">
                      {r.applies_to === "both"
                        ? "Both"
                        : r.applies_to === "shop"
                          ? "Shop"
                          : "Explore"}
                    </Status>
                  </td>
                  <td>
                    <Status>{statusLabel(r)}</Status>
                  </td>
                  <td>
                    <button
                      className="table-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(r);
                      }}
                    >
                      Edit
                    </button>
                    {r.status !== "archived" && (
                      <button
                        className="table-link danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          void archive(r);
                        }}
                      >
                        Archive
                      </button>
                    )}
                    <button
                      className="table-link danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        void remove(r);
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length && <Empty>No discounts yet.</Empty>}
        </div>
      </section>
      {editing !== null && (
        <Modal
          title={editing ? "Edit discount" : "Create discount"}
          close={() => setEditing(null)}
        >
          <form className="admin-form-grid" onSubmit={(e) => void save(e)}>
            <label>
              Code
              <input
                required
                name="code"
                pattern="[A-Za-z0-9_-]{3,40}"
                defaultValue={current?.code ?? ""}
              />
            </label>
            <label>
              Type
              <select name="type" defaultValue={current?.type ?? "percentage"}>
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </label>
            <label>
              Value
              <input
                required
                name="value"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={current?.value ?? ""}
              />
            </label>
            <label>
              Maximum cap (GHS)
              <input
                name="max_cap"
                type="number"
                min="0"
                step="0.01"
                defaultValue={current?.max_cap ?? ""}
              />
            </label>
            <label>
              Start date
              <input
                name="start_date"
                type="datetime-local"
                defaultValue={current?.start_date?.slice(0, 16) ?? ""}
              />
            </label>
            <label>
              End date
              <input
                name="end_date"
                type="datetime-local"
                defaultValue={current?.end_date?.slice(0, 16) ?? ""}
              />
            </label>
            <label>
              Total use limit
              <input
                name="total_limit"
                type="number"
                min="1"
                defaultValue={current?.total_limit ?? ""}
              />
            </label>
            <label>
              Per customer limit
              <input
                name="per_customer_limit"
                type="number"
                min="1"
                defaultValue={current?.per_customer_limit ?? ""}
              />
            </label>
            <label>
              Minimum order (GHS)
              <input
                name="min_order_amount"
                type="number"
                min="0"
                step="0.01"
                defaultValue={current?.min_order_amount ?? 0}
              />
            </label>
            <label>
              Applies to
              <select
                name="applies_to"
                defaultValue={current?.applies_to ?? "shop"}
              >
                <option value="shop">Shop</option>
                <option value="explore">Explore</option>
                <option value="both">Both</option>
              </select>
            </label>
            <label>
              Status
              <select name="status" defaultValue={current?.status ?? "draft"}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <div className="admin-form-actions admin-form-wide">
              <button
                type="button"
                className="drawer-secondary"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button className="a-button dark" disabled={busy}>
                {busy ? "Saving…" : "Save discount"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function PaymentsPage({
  rows,
  orders,
  onRefresh,
}: {
  rows: Payment[];
  orders: Order[];
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState("All");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    const text =
      `${r.provider_reference ?? ""} ${r.orders?.order_code ?? ""} ${r.orders?.customer_name ?? ""}`.toLowerCase();
    const matches = !q || text.includes(q);
    const matchTab =
      tab === "All" ||
      (tab === "Shop" && r.orders?.order_type === "store_purchase") ||
      (tab === "Requests" && r.orders?.order_type !== "store_purchase") ||
      (tab === "Refunds" &&
        r.transaction_type.toLowerCase().includes("refund")) ||
      (tab === "Payment Links" &&
        r.transaction_type.toLowerCase().includes("link"));
    return matches && matchTab && (status === "all" || r.status === status);
  });
  async function removePayment(row: Payment) {
    if (!window.confirm("Delete this payment record? This cannot be undone."))
      return;
    const { error } = await supabase
      .from("order_payments")
      .delete()
      .eq("id", row.id);
    if (error) sayPayment(`Could not delete payment: ${error.message}`);
    else {
      sayPayment("Payment record deleted.");
      onRefresh();
    }
  }
  const [paymentNotice, setPaymentNotice] = useState("");
  const sayPayment = (message: string) => {
    setPaymentNotice(message);
    window.setTimeout(() => setPaymentNotice(""), 4000);
  };
  return (
    <>
      <PageHead eyebrow="FINANCE" title="Payments" />
      {paymentNotice && (
        <div className="admin-data-notice" role="status">
          {paymentNotice}
        </div>
      )}
      <div className="admin-tabs">
        {["All", "Shop", "Requests", "Refunds", "Payment Links"].map((x) => (
          <button
            className={tab === x ? "active" : ""}
            key={x}
            onClick={() => setTab(x)}
          >
            {x}
            {x === "All" && <span>{rows.length}</span>}
          </button>
        ))}
      </div>
      <div className="filter-bar">
        <label className="a-search">
          ⌕
          <input
            placeholder="Search reference or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {[...new Set(rows.map((r) => r.status))].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="button" onClick={onRefresh}>
          Refresh
        </button>
      </div>
      <section className="a-panel table-panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>PAYSTACK REF</th>
                <th>LINKED CODE</th>
                <th>AMOUNT</th>
                <th>PAYSTACK FEE</th>
                <th>STATUS</th>
                <th>DATE</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const fee = orders.find(
                  (o) => o.id === r.order_id,
                )?.actual_payment_fee;
                return (
                  <tr key={r.id}>
                    <td>
                      <code>{r.provider_reference ?? "—"}</code>
                    </td>
                    <td>
                      <button className="table-link">
                        {r.orders?.order_code ?? r.order_id.slice(0, 8)}
                      </button>
                    </td>
                    <td>
                      <strong>
                        {r.currency_code} {Number(r.amount).toLocaleString()}
                      </strong>
                    </td>
                    <td className="muted">
                      {fee == null
                        ? "—"
                        : `${r.currency_code} ${Number(fee).toLocaleString()}`}
                    </td>
                    <td>
                      <Status>{r.status}</Status>
                    </td>
                    <td>{new Date(r.created_at).toLocaleString()}</td>
                    <td>
                      <button
                        className="table-link danger"
                        onClick={() => void removePayment(r)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filtered.length && (
            <Empty>No payment records match this view.</Empty>
          )}
        </div>
      </section>
    </>
  );
}

function DeliveryPage({
  value,
  areas,
  settings,
  onRefresh,
  say,
}: {
  value: Delivery;
  areas: DeliveryArea[];
  settings: Settings;
  onRefresh: () => void;
  say: (s: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<DeliveryArea | null | false>(null);
  const [search, setSearch] = useState("");
  const current = editing && typeof editing === "object" ? editing : null;
  async function saveDefaults(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget),
      number = (k: string) =>
        String(f.get(k) ?? "").trim() ? Number(f.get(k)) : null,
      min = Number(f.get("min")),
      max = Number(f.get("max"));
    if (max < min) {
      say("The maximum delivery window must be at least the minimum.");
      setBusy(false);
      return;
    }
    const deliveryValues = {
      free_delivery_areas: areas
        .filter((a) => a.free_delivery && a.status === "active")
        .map((a) => a.area),
      updated_at: new Date().toISOString(),
    };
    const storeValues = {
      delivery_min_days: min,
      delivery_max_days: max,
      urgent_fee_per_day_percent: number("urgent") ?? 20,
      updated_at: new Date().toISOString(),
    };
    const [d, s] = await Promise.all([
      supabase
        .from("store_delivery_settings")
        .update(deliveryValues)
        .eq("singleton", true),
      supabase.from("store_settings").update(storeValues).eq("singleton", true),
    ]);
    if (d.error || s.error)
      say(d.error?.message ?? s.error?.message ?? "Could not save settings.");
    else {
      say("Delivery defaults saved.");
      onRefresh();
    }
    setBusy(false);
  }
  async function saveArea(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget),
      values = {
        region: String(f.get("region") ?? "").trim(),
        area: String(f.get("area") ?? "").trim(),
        fee: Number(f.get("fee") ?? 0),
        free_delivery: f.get("free") === "on",
        status: String(f.get("status") ?? "active"),
        updated_at: new Date().toISOString(),
      };
    const result = current
      ? await supabase
          .from("delivery_areas")
          .update(values)
          .eq("id", current.id)
      : await supabase.from("delivery_areas").insert(values);
    if (result.error) say(result.error.message);
    else {
      say("Delivery area saved.");
      setEditing(null);
      onRefresh();
    }
    setBusy(false);
  }
  async function archiveArea(row: DeliveryArea) {
    const { error } = await supabase
      .from("delivery_areas")
      .delete()
      .eq("id", row.id);
    if (error) say(error.message);
    else {
      say("Delivery area deleted.");
      onRefresh();
    }
  }
  return (
    <>
      <PageHead
        eyebrow="OPERATIONS"
        title="Delivery Settings"
        action={busy ? "Saving…" : "Save changes"}
        onAction={() =>
          document.getElementById("delivery-defaults-submit")?.click()
        }
      />
      <form className="settings-strip" onSubmit={(e) => void saveDefaults(e)}>
        <label>
          Urgent order fee{" "}
          <div>
            <span>%</span>
            <input
              name="urgent"
              type="number"
              min="0"
              step="0.01"
              defaultValue={settings?.urgent_fee_per_day_percent ?? 20}
            />
          </div>
        </label>
        <label>
          Default delivery window{" "}
          <div>
            <input
              name="min"
              type="number"
              min="0"
              defaultValue={settings?.delivery_min_days ?? 1}
            />
            <span>to</span>
            <input
              name="max"
              type="number"
              min="0"
              defaultValue={settings?.delivery_max_days ?? 2}
            />
            <span>days</span>
          </div>
        </label>
        <button
          id="delivery-defaults-submit"
          className="a-button dark"
          disabled={busy}
          type="submit"
        >
          Save changes
        </button>
      </form>
      <section className="a-panel table-panel">
        <div className="bulk-bar">
          <span>
            Delivery areas{" "}
            <b>{areas.filter((a) => a.status !== "archived").length}</b>
          </span>
          <label className="a-search">
            <span>⌕</span>
            <input
              placeholder="Search delivery areas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button className="a-button light" onClick={() => setEditing(false)}>
            + Add area
          </button>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>REGION</th>
                <th>AREA</th>
                <th>DELIVERY FEE</th>
                <th>FREE DELIVERY</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {areas
                .filter(
                  (a) =>
                    a.status !== "archived" &&
                    `${a.region} ${a.area}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                )
                .map((a) => (
                  <tr key={a.id}>
                    <td>{a.region}</td>
                    <td>
                      <strong>{a.area}</strong>
                    </td>
                    <td>
                      <div className="inline-money">
                        <span>GHS</span>
                        <input
                          aria-label={`Delivery fee for ${a.area}`}
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={a.fee}
                          onBlur={(e) => {
                            const fee = Number(e.target.value);
                            if (fee !== Number(a.fee))
                              void supabase
                                .from("delivery_areas")
                                .update({
                                  fee,
                                  updated_at: new Date().toISOString(),
                                })
                                .eq("id", a.id)
                                .then(({ error }) => {
                                  if (error) say(error.message);
                                  else onRefresh();
                                });
                          }}
                        />
                      </div>
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={a.free_delivery}
                        onChange={(e) =>
                          void supabase
                            .from("delivery_areas")
                            .update({
                              free_delivery: e.target.checked,
                              updated_at: new Date().toISOString(),
                            })
                            .eq("id", a.id)
                            .then(({ error }) => {
                              if (error) say(error.message);
                              else onRefresh();
                            })
                        }
                      />
                    </td>
                    <td>
                      <Status>{a.status}</Status>
                    </td>
                    <td>
                      <button
                        className="table-link"
                        onClick={() => setEditing(a)}
                      >
                        Edit
                      </button>
                      <button
                        className="table-link danger"
                        onClick={() => void archiveArea(a)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!areas.length && (
            <Empty>Add delivery areas and set their fees.</Empty>
          )}
        </div>
      </section>
      {editing !== null && (
        <Modal
          title={current ? "Edit delivery area" : "Add delivery area"}
          close={() => setEditing(null)}
        >
          <form className="admin-form-grid" onSubmit={(e) => void saveArea(e)}>
            <label>
              Region
              <input
                name="region"
                required
                defaultValue={current?.region ?? ""}
              />
            </label>
            <label>
              Area
              <input name="area" required defaultValue={current?.area ?? ""} />
            </label>
            <label>
              Fee (GHS)
              <input
                name="fee"
                required
                type="number"
                min="0"
                step="0.01"
                defaultValue={current?.fee ?? 0}
              />
            </label>
            <label className="admin-check">
              <input
                type="checkbox"
                name="free"
                defaultChecked={current?.free_delivery ?? false}
              />
              Free delivery
            </label>
            <label>
              Status
              <select name="status" defaultValue={current?.status ?? "active"}>
                <option value="active">Active</option>
                <option value="hidden">Hidden</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <div className="admin-form-actions admin-form-wide">
              <button
                type="button"
                className="drawer-secondary"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button className="a-button dark" disabled={busy}>
                {busy ? "Saving…" : "Save area"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function SettingsPage({
  value,
  preferences,
  onRefresh,
  say,
  onEnablePush,
  pushStatus,
  pushEnabled,
}: {
  value: Settings;
  preferences: Preferences | null;
  onRefresh: () => void;
  say: (s: string) => void;
  onEnablePush: () => void;
  pushStatus: string;
  pushEnabled: boolean;
}) {
  const [busy, setBusy] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const settings = {
      store_name: String(f.get("store_name") ?? "WearWise").trim(),
      whatsapp_number: String(f.get("whatsapp_number") ?? "").trim(),
      updated_at: new Date().toISOString(),
    };
    const prefs = {
      owner_name: String(f.get("owner_name") ?? "").trim(),
      owner_phone: String(f.get("owner_phone") ?? "").trim(),
      quote_whatsapp_template: String(f.get("quote_template") ?? ""),
      dispatched_whatsapp_template: String(f.get("dispatch_template") ?? ""),
      notify_paid_orders: f.get("notify_paid") === "on",
      notify_design_requests: f.get("notify_requests") === "on",
      notify_low_stock: f.get("notify_stock") === "on",
      updated_at: new Date().toISOString(),
    };
    const [s, p] = await Promise.all([
      supabase.from("store_settings").update(settings).eq("singleton", true),
      supabase
        .from("admin_preferences")
        .upsert({ singleton: true, ...prefs }, { onConflict: "singleton" }),
    ]);
    if (s.error || p.error)
      say(s.error?.message ?? p.error?.message ?? "Could not save settings.");
    else {
      say("Settings saved.");
      onRefresh();
    }
    setBusy(false);
  }
  return (
    <>
      <PageHead
        eyebrow="WORKSPACE"
        title="Settings"
        action={busy ? "Saving…" : "Save changes"}
        onAction={() =>
          document.getElementById("admin-settings-submit")?.click()
        }
      />
      <form id="admin-settings-form" onSubmit={(e) => void save(e)}>
        <section className="settings-list">
          <div className="a-panel settings-section">
            <div>
              <h2>Admin profile</h2>
              <p>Your personal details and account preferences.</p>
            </div>
            <div className="settings-fields">
              <label>
                Full name
                <input
                  name="owner_name"
                  defaultValue={preferences?.owner_name ?? ""}
                />
              </label>
              <label>
                Store name
                <input
                  name="store_name"
                  defaultValue={value?.store_name ?? "WearWise"}
                />
              </label>
              <label>
                Phone number
                <input
                  name="owner_phone"
                  defaultValue={preferences?.owner_phone ?? ""}
                />
              </label>
              <label>
                WhatsApp Business number
                <input
                  name="whatsapp_number"
                  defaultValue={value?.whatsapp_number ?? ""}
                />
              </label>
            </div>
          </div>
          <div className="a-panel settings-section">
            <div>
              <h2>Paystack connection</h2>
              <p>Payment connection status.</p>
            </div>
            <div className="connection-card">
              <span className="connection-icon">P</span>
              <div>
                <strong>Paystack</strong>
                <small>
                  Secret keys remain in Supabase Edge Function secrets.
                </small>
              </div>
              <Status>Managed</Status>
              <span>
                Connection is controlled by Supabase Edge Function secrets.
              </span>
            </div>
          </div>
          <div className="a-panel settings-section">
            <div>
              <h2>WhatsApp templates</h2>
              <p>Messages sent during order updates.</p>
            </div>
            <div className="settings-fields">
              <label>
                Quote ready
                <textarea
                  rows={3}
                  name="quote_template"
                  defaultValue={
                    preferences?.quote_whatsapp_template ??
                    "Hi {{name}}, your WEARWISE quote {{code}} is ready. Total: GHS {{total}}."
                  }
                />
              </label>
              <label>
                Order dispatched
                <textarea
                  rows={3}
                  name="dispatch_template"
                  defaultValue={
                    preferences?.dispatched_whatsapp_template ??
                    "Your order {{code}} is on the way. Track it here: {{link}}"
                  }
                />
              </label>
            </div>
          </div>
          <div className="a-panel settings-section">
            <div>
              <h2>Notifications</h2>
              <p>Choose what needs your attention.</p>
            </div>
            <div className="toggle-list">
              <div className="push-setting">
                <span>
                  <strong>Phone notifications</strong>
                  <small>
                    Receive WearWise alerts even when the site is closed.
                  </small>
                </span>
                <button
                  type="button"
                  className={`notification-toggle ${pushEnabled ? "on" : ""}`}
                  onClick={onEnablePush}
                  role="switch"
                  aria-checked={pushEnabled}
                  aria-label="Enable phone notifications"
                >
                  <i />
                </button>
                {pushStatus && (
                  <small className="push-status" role="status">
                    {pushStatus}
                  </small>
                )}
              </div>
              {[
                [
                  "New paid orders",
                  "notify_paid",
                  preferences?.notify_paid_orders ?? true,
                ],
                [
                  "New design requests",
                  "notify_requests",
                  preferences?.notify_design_requests ?? true,
                ],
                [
                  "Low stock warnings",
                  "notify_stock",
                  preferences?.notify_low_stock ?? true,
                ],
              ].map(([label, name, checked]) => (
                <label key={String(name)}>
                  <span>
                    <strong>{String(label)}</strong>
                    <small>Admin preference saved to Supabase.</small>
                  </span>
                  <input
                    type="checkbox"
                    name={String(name)}
                    defaultChecked={Boolean(checked)}
                  />
                </label>
              ))}
            </div>
          </div>
          <button
            id="admin-settings-submit"
            className="a-button dark"
            disabled={busy}
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </section>
      </form>
    </>
  );
}

function AnalyticsPage({
  orders,
  products,
}: {
  orders: Order[];
  products: StoreItem[];
}) {
  const [period, setPeriod] = useState("This Month"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const now = new Date(),
    start = new Date(now);
  if (period === "Today") start.setHours(0, 0, 0, 0);
  else if (period === "Yesterday") {
    start.setDate(now.getDate() - 1);
    start.setHours(0, 0, 0, 0);
  } else if (period === "This Week") start.setDate(now.getDate() - 7);
  else if (period === "This Month") start.setDate(1);
  else if (period === "Last Month") {
    start.setMonth(now.getMonth() - 1, 1);
    start.setHours(0, 0, 0, 0);
  } else if (period === "This Year") start.setMonth(0, 1);
  else if (period === "Custom range" && from)
    start.setTime(new Date(from).getTime());
  const filtered = orders.filter((o) => {
    const date = new Date(o.created_at);
    return period === "Custom range"
      ? (from ? date >= new Date(from) : true) &&
          (to ? date <= new Date(`${to}T23:59:59`) : true)
      : period === "Yesterday"
        ? date >= start &&
          date < new Date(now.getFullYear(), now.getMonth(), now.getDate())
        : date >= start;
  });
  const paid = filtered.filter((o) => Number(o.amount_paid) > 0),
    sales = paid.reduce(
      (s, o) => s + Number(o.amount_paid) - Number(o.amount_refunded),
      0,
    ),
    refunds = filtered.reduce((s, o) => s + Number(o.amount_refunded), 0),
    costComplete = filtered.filter((o) => o.actual_costs_recorded_at),
    coreCosts = costComplete.reduce(
      (s, o) =>
        s +
        Number(o.actual_sourcing_cost) +
        Number(o.actual_printing_cost) +
        Number(o.actual_other_cost),
      0,
    ),
    feeCosts = costComplete.reduce(
      (s, o) => s + Number(o.actual_payment_fee),
      0,
    ),
    deliveryRevenue = paid.reduce((s, o) => s + Number(o.delivery_fee ?? 0), 0),
    gross = sales - coreCosts,
    net =
      sales -
      costComplete.reduce(
        (s, o) =>
          s +
          Number(o.actual_sourcing_cost) +
          Number(o.actual_printing_cost) +
          Number(o.actual_delivery_cost) +
          Number(o.actual_payment_fee) +
          Number(o.actual_other_cost),
        0,
      ),
    discounts = paid.reduce((s, o) => s + Number(o.discount_amount ?? 0), 0),
    shop = paid
      .filter((o) => o.order_type === "store_purchase")
      .reduce(
        (s, o) => s + Number(o.amount_paid) - Number(o.amount_refunded),
        0,
      ),
    explore = sales - shop,
    urgent = filtered.filter((o) => o.rush_days_early > 0),
    urgentFees = urgent.reduce((s, o) => s + Number(o.rush_fee ?? 0), 0);
  const kpis: [string, string, string][] = [
    [
      "TOTAL SALES",
      `GHS ${sales.toLocaleString()}`,
      `${paid.length} orders with payment`,
    ],
    [
      "TOTAL COSTS",
      `GHS ${coreCosts.toLocaleString()}`,
      `${costComplete.length} orders with costs entered`,
    ],
    [
      "DISCOUNTS",
      `GHS ${discounts.toLocaleString()}`,
      "Discount amounts recorded",
    ],
    [
      "PAYSTACK FEES",
      `GHS ${feeCosts.toLocaleString()}`,
      "Actual fees entered",
    ],
    [
      "DELIVERY FEES",
      `GHS ${deliveryRevenue.toLocaleString()}`,
      "Collected from customers",
    ],
    [
      "GROSS PROFIT",
      `GHS ${gross.toLocaleString()}`,
      `Before delivery and payment costs`,
    ],
    [
      "NET EST. PROFIT",
      `GHS ${net.toLocaleString()}`,
      `${Math.max(0, filtered.length - costComplete.length)} orders missing cost entries`,
    ],
    ["LOSSES / REFUNDS", `GHS ${refunds.toLocaleString()}`, "Refunds recorded"],
  ];
  const topProducts = new Map<string, number>();
  filtered.forEach((o) =>
    o.order_items?.forEach((i) => {
      if (i.store_item_id)
        topProducts.set(
          i.store_item_id,
          (topProducts.get(i.store_item_id) ?? 0) + Number(i.quantity),
        );
    }),
  );
  const best = [...topProducts]
    .map(([id, count]) => ({
      name: products.find((p) => p.id === id)?.name ?? "Removed item",
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const totalUnits = best.reduce((s, p) => s + p.count, 0);
  const categoryTotals = new Map<string, number>();
  filtered.forEach((o) =>
    o.order_items?.forEach((i) => {
      const category =
        products.find((p) => p.id === i.store_item_id)?.category ?? "Other";
      categoryTotals.set(
        category,
        (categoryTotals.get(category) ?? 0) + Number(i.quantity),
      );
    }),
  );
  const categories = [...categoryTotals]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const daily = Array.from({ length: 7 }, (_, idx) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - idx));
    day.setHours(0, 0, 0, 0);
    const end = new Date(day);
    end.setDate(end.getDate() + 1);
    return {
      label: day
        .toLocaleDateString(undefined, { weekday: "short" })
        .toUpperCase(),
      amount: filtered
        .filter(
          (o) => new Date(o.created_at) >= day && new Date(o.created_at) < end,
        )
        .reduce(
          (s, o) => s + Number(o.amount_paid) - Number(o.amount_refunded),
          0,
        ),
    };
  });
  return (
    <>
      <PageHead
        eyebrow="BUSINESS INTELLIGENCE"
        title="Analytics"
        action="Export CSV"
        onAction={() => exportAnalytics(filtered)}
      />
      <div className="date-pills">
        {[
          "Today",
          "Yesterday",
          "This Week",
          "This Month",
          "Last Month",
          "This Year",
          "Custom range",
        ].map((x) => (
          <button
            className={x === period ? "active" : ""}
            key={x}
            onClick={() => setPeriod(x)}
          >
            {x}
          </button>
        ))}
      </div>
      {period === "Custom range" && (
        <div className="filter-bar">
          <label>
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
      )}
      <div className="analytics-kpis">
        {kpis.map(([label, value, note], i) => (
          <div className="a-panel" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small className={i === 7 ? "red" : ""}>{note}</small>
          </div>
        ))}
      </div>
      <div className="analytics-charts">
        <section className="a-panel">
          <PanelHead title="Profit trend" meta="Net sales · last 7 days" />
          <TrendChart
            values={daily.map((d) => d.amount)}
            labels={daily.map((d) => d.label)}
          />
        </section>
        <section className="a-panel">
          <PanelHead title="Best selling products" meta="By quantity" />
          <div className="bar-chart">
            {best.map((p) => (
              <div key={p.name}>
                <span>{p.name}</span>
                <i>
                  <b
                    style={{
                      width: `${totalUnits ? Math.max(4, (p.count / totalUnits) * 100) : 0}%`,
                    }}
                  />
                </i>
                <strong>{p.count}</strong>
              </div>
            ))}
            {!best.length && (
              <Empty>
                Sales by product appear as order items are recorded.
              </Empty>
            )}
          </div>
        </section>
        <section className="a-panel">
          <PanelHead title="Category breakdown" meta="By items sold" />
          <div className="donut-wrap">
            <div className="donut">
              <span>
                <strong>{totalUnits}</strong>
                <small>Items</small>
              </span>
            </div>
            <div className="legend">
              {categories.map(([name, count]) => (
                <span key={name}>
                  <i />
                  {name}{" "}
                  {totalUnits ? Math.round((count / totalUnits) * 100) : 0}%
                </span>
              ))}
              {!categories.length && (
                <small>No item sales in this period.</small>
              )}
            </div>
          </div>
        </section>
      </div>
      <div className="split-cards">
        <div className="a-panel">
          <span>SHOP REVENUE</span>
          <strong>GHS {shop.toLocaleString()}</strong>
          <i>{sales ? Math.round((shop / sales) * 100) : 0}%</i>
        </div>
        <div className="a-panel lime">
          <span>EXPLORE REVENUE</span>
          <strong>GHS {explore.toLocaleString()}</strong>
          <i>{sales ? Math.round((explore / sales) * 100) : 0}%</i>
        </div>
        <div className="a-panel">
          <span>URGENT ORDERS</span>
          <strong>{urgent.length} orders</strong>
          <i>GHS {urgentFees.toLocaleString()} fees</i>
        </div>
      </div>
      <section className="a-panel admin-analytics-note">
        <h2>Profit reporting</h2>
        <p>
          Profit uses only actual order costs saved from the order screens.
          Orders without recorded costs are not treated as free. Current reports
          use the latest 1,000 orders available to this admin.
        </p>
      </section>
    </>
  );
}

function TrendChart({
  values,
  labels,
}: {
  values: number[];
  labels: string[];
}) {
  const width = 600,
    height = 220,
    max = Math.max(1, ...values);
  const pts = values
    .map(
      (v, i) =>
        `${(i * 600) / Math.max(1, values.length - 1)},${190 - (v / max) * 150}`,
    )
    .join(" ");
  return (
    <>
      <div className="line-chart">
        <div className="chart-grid" />
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="figma-profit-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#c8ff00" stopOpacity=".35" />
              <stop offset="1" stopColor="#c8ff00" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polyline className="area" points={`${pts} ${width},220 0,220`} />
          <polyline className="line" points={pts} />
          {values.map((v, i) => (
            <circle
              key={i}
              cx={(i * 600) / Math.max(1, values.length - 1)}
              cy={190 - (v / max) * 150}
              r="4"
            />
          ))}
        </svg>
        <div className="chart-tip">
          <small>7 DAY SALES</small>
          <strong>
            GHS {values.reduce((s, v) => s + v, 0).toLocaleString()}
          </strong>
        </div>
      </div>
      <div className="chart-axis">
        {labels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </>
  );
}

function exportAnalytics(orders: Order[]) {
  const headers = [
    "order_code",
    "order_type",
    "created_at",
    "amount_paid",
    "amount_refunded",
    "actual_sourcing_cost",
    "actual_printing_cost",
    "actual_delivery_cost",
    "actual_payment_fee",
    "actual_other_cost",
  ];
  const lines = [
    headers.join(","),
    ...orders.map((o) =>
      headers
        .map((key) =>
          JSON.stringify((o as unknown as Record<string, unknown>)[key] ?? ""),
        )
        .join(","),
    ),
  ];
  const url = URL.createObjectURL(
    new Blob([lines.join("\n")], { type: "text/csv" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "wearwise-analytics.csv";
  a.click();
  URL.revokeObjectURL(url);
}
