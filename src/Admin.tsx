import { FormEvent, useEffect, useState } from "react";
import AdminSections from "./AdminSections";
import "./admin.css";
import { enablePushNotifications } from "./lib/push";
import { supabase } from "./lib/supabase";

const ADMIN_USER_ID = "c219bece-37e4-4357-a61d-0cb75674ed4c";
type AdminPage =
  | "dashboard"
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
type AdminUser = { email: string | null | undefined };
type AdminOrder = {
  id: string;
  order_code: string;
  order_type: string;
  status: string;
  payment_status: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_request: string | null;
  selected_design_snapshot: unknown;
  proof_image_path: string | null;
  delivery_area: string | null;
  delivery_address: string | null;
  delivery_instructions: string | null;
  subtotal: number | string;
  discount_amount: number | string;
  discount_id: string | null;
  delivery_fee: number | string;
  rush_fee: number | string;
  total_amount: number | string;
  amount_paid: number | string;
  amount_refunded: number | string;
  currency_code: string;
  rush_days_early: number;
  availability_confirmed_at: string | null;
  payment_link: string | null;
  payment_link_expiry: string | null;
  approval_status: string;
  cost_price_locked: number | string | null;
  supplier_cost: number | string | null;
  profit: number | string | null;
  cost_locked_at: string | null;
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
type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image_url: string | null;
  status: "active" | "hidden" | "archived";
  created_at: string;
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
type PaymentRow = {
  id: string;
  order_id: string;
  transaction_type: string;
  status: string;
  provider: string | null;
  provider_reference: string | null;
  amount: number | string;
  currency_code: string;
  confirmed_at: string | null;
  created_at: string;
  orders?: {
    order_code: string;
    customer_name: string;
    order_type: string;
  } | null;
};
type DeliverySettings = {
  campus_handoff_fee: number | string;
  sister_office_handoff_fee: number | string;
  free_delivery_areas: string[];
};
type StoreSettings = {
  store_name: string;
  whatsapp_number: string;
  delivery_min_days: number;
  delivery_max_days: number;
  urgent_fee_per_day_percent: number;
};
type ItemCost = {
  store_item_id: string;
  purchase_cost: number | string | null;
  other_cost: number | string | null;
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
type VariantCost = { variant_id: string; cost_price: number | string | null };
type GalleryDesign = {
  id: string;
  title: string | null;
  category: string;
  image_path: string;
  preview_path: string | null;
  published: boolean;
};
type DeliveryArea = {
  id: string;
  region: string;
  area: string;
  fee: number | string;
  free_delivery: boolean;
  status: string;
  updated_at: string;
};
type AdminPreferences = {
  owner_name: string;
  owner_phone: string;
  quote_whatsapp_template: string;
  dispatched_whatsapp_template: string;
  notify_paid_orders: boolean;
  notify_design_requests: boolean;
  notify_low_stock: boolean;
};
type AdminNotification = {
  id: string;
  kind: "paid_order" | "design_request" | "low_stock";
  title: string;
  body: string;
  order_id: string | null;
  store_item_id: string | null;
  created_at: string;
  read_at: string | null;
};
type AdminData = {
  orders: AdminOrder[];
  orderCount: number;
  productCount: number;
  pendingCount: number;
  products: StoreItem[];
  shirtTypes: ShirtType[];
  variants: ProductVariant[];
  designs: GalleryDesign[];
  categories: Category[];
  discounts: Discount[];
  payments: PaymentRow[];
  delivery: DeliverySettings | null;
  deliveryAreas: DeliveryArea[];
  settings: StoreSettings | null;
  preferences: AdminPreferences | null;
  notifications: AdminNotification[];
};

const nav: { page: AdminPage; label: string; glyph: string }[] = [
  { page: "dashboard", label: "Dashboard", glyph: "⌂" },
  { page: "orders", label: "Shop Orders", glyph: "□" },
  { page: "requests", label: "Design Requests", glyph: "◇" },
  { page: "products", label: "Products", glyph: "▦" },
  { page: "shirt-types", label: "Shirt Types", glyph: "👕" },
  { page: "categories", label: "Categories", glyph: "⌗" },
  { page: "discounts", label: "Discounts", glyph: "%" },
  { page: "payments", label: "Payments", glyph: "₵" },
  { page: "delivery", label: "Delivery Settings", glyph: "→" },
  { page: "analytics", label: "Analytics", glyph: "⌁" },
  { page: "settings", label: "Settings", glyph: "○" },
];

function Status({ children }: { children: React.ReactNode }) {
  const auto = String(children).toLowerCase().replaceAll(" ", "-");
  return <span className={`a-status ${auto}`}>{children}</span>;
}

function Admin({
  onExit,
  onCatalogRefresh,
}: {
  onExit: () => void;
  onCatalogRefresh: () => void;
}) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState<AdminPage>("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [data, setData] = useState<AdminData>({
    orders: [],
    orderCount: 0,
    productCount: 0,
    pendingCount: 0,
    products: [],
    shirtTypes: [],
    variants: [],
    designs: [],
    categories: [],
    discounts: [],
    payments: [],
    delivery: null,
    deliveryAreas: [],
    settings: null,
    preferences: null,
    notifications: [],
  });
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [pushStatus, setPushStatus] = useState("");
  const [pushEnabled, setPushEnabled] = useState(true);

  useEffect(() => {
    let active = true;
    void supabase.auth
      .getUser()
      .then(async ({ data: authData, error: authError }) => {
        if (!active) return;
        const authUser = authData.user;
        if (!authError && authUser?.id === ADMIN_USER_ID)
          setUser({ email: authUser.email });
        else if (authUser) await supabase.auth.signOut();
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    async function loadAdminData() {
      setLoadingData(true);
      setDataError("");
      const [
        orderTotal,
        pendingTotal,
        productTotal,
        recentOrders,
        products,
        itemCosts,
        variants,
        variantCosts,
        designs,
        shirtTypes,
        categories,
        discounts,
        payments,
        delivery,
        deliveryAreas,
        settings,
        preferences,
        notifications,
      ] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("payment_status", "awaiting_payment"),
        supabase
          .from("store_items")
          .select("id", { count: "exact", head: true })
          .eq("is_published", true),
        supabase
          .from("orders")
          .select(
            "id,order_code,order_type,status,payment_status,customer_name,customer_phone,customer_email,customer_request,customer_artwork_path,selected_design_snapshot,proof_image_path,delivery_area,delivery_address,delivery_instructions,subtotal,discount_amount,discount_id,delivery_fee,rush_fee,total_amount,amount_paid,amount_refunded,currency_code,rush_days_early,availability_confirmed_at,payment_link,payment_link_expiry,approval_status,cost_price_locked,supplier_cost,profit,cost_locked_at,actual_sourcing_cost,actual_printing_cost,actual_delivery_cost,actual_payment_fee,actual_other_cost,actual_costs_recorded_at,created_at,order_items(quantity,store_item_id,product_name_snapshot,requested_size,requested_color,quoted_unit_price)",
          )
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("store_items")
          .select(
            "id,name,category,category_id,description,price,image_paths,size_options,color_options,is_published,is_available,stock_quantity",
          )
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("store_item_costs")
          .select("store_item_id,purchase_cost,other_cost"),
        supabase
          .from("product_variants")
          .select("id,product_id,size,color,stock,selling_price,status")
          .order("size"),
        supabase.from("product_variant_costs").select("variant_id,cost_price"),
        supabase
          .from("designs")
          .select("id,title,category,image_path,preview_path,published")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("products")
          .select(
            "id,name,category,usual_sizes,usual_colors,is_active,created_at,updated_at",
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("categories")
          .select("id,name,slug,description,image_url,status,created_at")
          .order("name"),
        supabase
          .from("discounts")
          .select(
            "id,code,type,value,max_cap,start_date,end_date,total_limit,per_customer_limit,min_order_amount,applies_to,status,used_count",
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("order_payments")
          .select(
            "id,order_id,transaction_type,status,provider,provider_reference,amount,currency_code,confirmed_at,created_at,orders(order_code,customer_name,order_type)",
          )
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("store_delivery_settings")
          .select(
            "campus_handoff_fee,sister_office_handoff_fee,free_delivery_areas",
          )
          .eq("singleton", true)
          .maybeSingle(),
        supabase
          .from("delivery_areas")
          .select("id,region,area,fee,free_delivery,status,updated_at")
          .order("region")
          .order("area"),
        supabase
          .from("store_settings")
          .select(
            "store_name,whatsapp_number,delivery_min_days,delivery_max_days,urgent_fee_per_day_percent",
          )
          .eq("singleton", true)
          .maybeSingle(),
        supabase
          .from("admin_preferences")
          .select(
            "owner_name,owner_phone,quote_whatsapp_template,dispatched_whatsapp_template,notify_paid_orders,notify_design_requests,notify_low_stock",
          )
          .eq("singleton", true)
          .maybeSingle(),
        supabase
          .from("admin_notifications")
          .select(
            "id,kind,title,body,order_id,store_item_id,created_at,read_at",
          )
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      if (!active) return;
      const queryError =
        orderTotal.error ??
        pendingTotal.error ??
        productTotal.error ??
        recentOrders.error ??
        products.error ??
        itemCosts.error ??
        variants.error ??
        variantCosts.error ??
        designs.error ??
        shirtTypes.error ??
        categories.error ??
        discounts.error ??
        payments.error ??
        delivery.error ??
        deliveryAreas.error ??
        settings.error ??
        preferences.error ??
        notifications.error;
      if (queryError) setDataError(queryError.message);
      const costs = new Map<string, ItemCost>(
        ((itemCosts.data ?? []) as ItemCost[]).map((cost) => [
          cost.store_item_id,
          cost,
        ]),
      );
      const mappedProducts = ((products.data ?? []) as StoreItem[]).map(
        (item) => ({
          ...item,
          purchase_cost: costs.get(item.id)?.purchase_cost ?? null,
          other_cost: costs.get(item.id)?.other_cost ?? null,
        }),
      );
      const variantCostMap = new Map<string, VariantCost>(
        ((variantCosts.data ?? []) as VariantCost[]).map((cost) => [
          cost.variant_id,
          cost,
        ]),
      );
      const mappedVariants = ((variants.data ?? []) as ProductVariant[]).map(
        (variant) => ({
          ...variant,
          cost_price: variantCostMap.get(variant.id)?.cost_price ?? null,
        }),
      );
      setData({
        orders: (recentOrders.data ?? []) as AdminOrder[],
        orderCount: orderTotal.count ?? 0,
        pendingCount: pendingTotal.count ?? 0,
        productCount: productTotal.count ?? 0,
        products: mappedProducts,
        shirtTypes: (shirtTypes.data ?? []) as ShirtType[],
        variants: mappedVariants,
        designs: (designs.data ?? []) as GalleryDesign[],
        categories: (categories.data ?? []) as Category[],
        discounts: (discounts.data ?? []) as Discount[],
        payments: (payments.data ?? []) as unknown as PaymentRow[],
        delivery: delivery.data as DeliverySettings | null,
        deliveryAreas: (deliveryAreas.data ?? []) as DeliveryArea[],
        settings: settings.data as StoreSettings | null,
        preferences: preferences.data as AdminPreferences | null,
        notifications: (notifications.data ?? []) as AdminNotification[],
      });
      setLoadingData(false);
    }
    void loadAdminData();
    return () => {
      active = false;
    };
  }, [user, reloadKey]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("wearwise-admin-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_notifications" },
        () => setReloadKey((key) => key + 1),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setError("");
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) {
      setError(authError.message);
      setWorking(false);
      return;
    }
    if (authData.user.id !== ADMIN_USER_ID) {
      await supabase.auth.signOut();
      setError("This account does not have WearWise owner access.");
      setWorking(false);
      return;
    }
    setPassword("");
    setUser({ email: authData.user.email });
    setWorking(false);
  }

  async function signOut() {
    setWorking(true);
    const { error: authError } = await supabase.auth.signOut();
    if (authError) setError(authError.message);
    else setUser(null);
    setWorking(false);
  }

  async function enablePhoneNotifications() {
    setPushStatus("Enabling…");
    try {
      await enablePushNotifications();
      setPushEnabled(true);
      setPushStatus("Phone notifications enabled");
    } catch (cause) {
      setPushStatus(
        cause instanceof Error
          ? cause.message
          : "Could not enable notifications.",
      );
      setPushEnabled(false);
    }
    window.setTimeout(() => setPushStatus(""), 5000);
  }

  // Auto-enable push notifications on load (default is on)
  useEffect(() => {
    let active = true;
    (async () => {
      if (!pushEnabled) return;
      await new Promise((r) => setTimeout(r, 500));
      if (!active) return;
      try {
        await enablePushNotifications();
        setPushStatus("Phone notifications enabled");
      } catch {
        setPushEnabled(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [pushEnabled]);

  async function openNotification(notification: AdminNotification) {
    await supabase
      .from("admin_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notification.id);
    setNotificationsOpen(false);
    setPage(
      notification.kind === "design_request"
        ? "requests"
        : notification.kind === "low_stock"
          ? "products"
          : "orders",
    );
    setReloadKey((key) => key + 1);
  }

  if (checkingSession)
    return (
      <div className="admin-login-shell">
        <div className="admin-login-card">Opening your admin workspace…</div>
      </div>
    );
  if (!user)
    return (
      <div className="admin-login-shell">
        <form
          className="admin-login-card"
          onSubmit={(event) => void signIn(event)}
        >
          <button type="button" className="admin-login-back" onClick={onExit}>
            ← Back to WearWise
          </button>
          <div className="admin-login-brand">
            WEAR<span>WISE</span>
            <small>ADMIN</small>
          </div>
          <span className="admin-login-eyebrow">PRIVATE STORE WORKSPACE</span>
          <h1>Welcome back.</h1>
          <p>Sign in with the WearWise owner account to continue.</p>
          <label>
            Email address
            <input
              required
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && (
            <div className="admin-login-error" role="alert">
              {error}
            </div>
          )}
          <button className="admin-login-submit" disabled={working}>
            {working ? "Signing in…" : "Sign in securely"}
          </button>
          <small className="admin-login-foot">
            Access is limited to the Supabase owner account.
          </small>
        </form>
        <aside className="admin-login-art">
          <span>WEARWISE / ACCRA</span>
          <strong>
            Your store,
            <br />
            in good hands.
          </strong>
          <small>ADMIN ACCESS · SECURED BY SUPABASE</small>
        </aside>
      </div>
    );

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayOrders = data.orders.filter(
    (order) => new Date(order.created_at) >= todayStart,
  );
  const todaySales = todayOrders.reduce(
    (sum, order) =>
      sum + Number(order.amount_paid) - Number(order.amount_refunded),
    0,
  );
  const requests = data.orders.filter(
    (order) => order.order_type !== "store_purchase",
  );
  const urgentOrders = data.orders.filter(
    (order) =>
      order.rush_days_early > 0 &&
      !["delivered", "completed", "cancelled"].includes(order.status),
  );
  const lowStock = data.products.filter(
    (item) =>
      item.is_published &&
      item.is_available &&
      item.stock_quantity !== null &&
      item.stock_quantity < 5,
  );
  const activeNav =
    nav.find((item) => item.page === page)?.label ?? "Dashboard";

  return (
    <div className="admin-app">
      <aside className={`admin-sidebar ${mobileNav ? "open" : ""}`}>
        <div className="admin-brand">
          WEAR<span>WISE</span>
          <small>ADMIN</small>
        </div>
        <nav>
          {nav.map((item) => (
            <button
              className={page === item.page ? "active" : ""}
              key={item.page}
              onClick={() => {
                setPage(item.page);
                setMobileNav(false);
              }}
            >
              <i>{item.glyph}</i>
              <span>{item.label}</span>
              {item.page === "orders" && data.orderCount > 0 && (
                <b>{data.orderCount}</b>
              )}
              {item.page === "requests" && requests.length > 0 && (
                <b>{requests.length}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="admin-profile">
          <span>{(user.email ?? "WW").slice(0, 2).toUpperCase()}</span>
          <div>
            <strong>{user.email}</strong>
            <small>Store owner</small>
          </div>
          <button
            onClick={() => void signOut()}
            title="Sign out"
            disabled={working}
          >
            ↗
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <button
            className="admin-menu"
            onClick={() => setMobileNav(!mobileNav)}
          >
            ☰
          </button>
          <div>
            <span>WEARWISE /</span> {activeNav}
          </div>
          <div className="admin-top-actions">
            <button
              className="admin-search"
              onClick={() => {
                if (page !== "orders") setPage("orders");
                window.setTimeout(
                  () =>
                    document
                      .querySelector<HTMLInputElement>(
                        ".filter-bar .a-search input",
                      )
                      ?.focus(),
                  80,
                );
              }}
            >
              ⌕ <span>Search anything</span>
              <kbd>⌘ K</kbd>
            </button>
            <div className="notification-wrap">
              <button
                className="notification"
                onClick={() => setNotificationsOpen((open) => !open)}
                title="Notifications"
                aria-label="Open notifications"
              >
                ♧{data.notifications.some((n) => !n.read_at) && <i />}
              </button>
              {notificationsOpen && (
                <div className="notification-menu">
                  <div className="notification-menu-head">
                    <strong>Notifications</strong>
                    <span>
                      {data.notifications.filter((n) => !n.read_at).length} new
                    </span>
                  </div>
                  {data.notifications.length ? (
                    data.notifications.map((n) => (
                      <button
                        key={n.id}
                        className={!n.read_at ? "unread" : ""}
                        onClick={() => void openNotification(n)}
                      >
                        <b>{n.title}</b>
                        <span>{n.body}</span>
                        <small>{new Date(n.created_at).toLocaleString()}</small>
                      </button>
                    ))
                  ) : (
                    <p>No notifications yet.</p>
                  )}
                </div>
              )}
            </div>
            <div className="avatar">
              {(user.email ?? "WW").slice(0, 2).toUpperCase()}
            </div>
          </div>
        </header>
        <div className="admin-content">
          {dataError && (
            <div className="admin-data-error" role="alert">
              Could not load live admin data: {dataError}
            </div>
          )}
          {page === "dashboard" ? (
            <Dashboard
              data={data}
              todaySales={todaySales}
              requestCount={requests.length}
              urgentCount={urgentOrders.length}
              lowStockCount={lowStock.length}
              loading={loadingData}
              go={setPage}
              onRefresh={() => setReloadKey((key) => key + 1)}
            />
          ) : (
            <AdminSections
              page={page}
              data={data}
              onRefresh={() => setReloadKey((key) => key + 1)}
              onCatalogRefresh={onCatalogRefresh}
              onDiscountSaved={(discount) =>
                setData((current) => ({
                  ...current,
                  discounts: [
                    discount,
                    ...current.discounts.filter(
                      (row) => row.id !== discount.id,
                    ),
                  ],
                }))
              }
              onEnablePush={enablePhoneNotifications}
              pushStatus={pushStatus}
              pushEnabled={pushEnabled}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function Dashboard({
  data,
  todaySales,
  requestCount,
  urgentCount,
  lowStockCount,
  loading,
  go,
  onRefresh,
}: {
  data: AdminData;
  todaySales: number;
  requestCount: number;
  urgentCount: number;
  lowStockCount: number;
  loading: boolean;
  go: (page: AdminPage) => void;
  onRefresh: () => void;
}) {
  const [chartPeriod, setChartPeriod] = useState("Week");
  const recent = data.orders.slice(0, 6);
  const needsQuote = data.orders
    .filter(
      (order) =>
        order.order_type !== "store_purchase" &&
        ["request_received", "awaiting_payment"].includes(order.status),
    )
    .slice(0, 3);
  const needsSourcing = data.orders
    .filter(
      (order) =>
        order.order_type === "store_purchase" &&
        ["paid", "sourcing"].includes(order.status),
    )
    .slice(0, 3);
  const proofs = data.orders
    .filter(
      (order) =>
        order.order_type !== "store_purchase" &&
        ["design_in_progress", "proof_sent", "revision_requested"].includes(
          order.status,
        ),
    )
    .slice(0, 3);
  const chartDays =
    chartPeriod === "Today"
      ? 1
      : chartPeriod === "Week"
        ? 7
        : chartPeriod === "Month"
          ? 30
          : 365;
  const chartOrders = data.orders.filter(
    (order) =>
      new Date(order.created_at) >= new Date(Date.now() - chartDays * 86400000),
  );
  const chartValues = Array.from({ length: 7 }, (_, index) => {
    const days = chartPeriod === "Today" ? 0 : 6 - index;
    const day = new Date();
    day.setDate(day.getDate() - days);
    day.setHours(0, 0, 0, 0);
    const end = new Date(day);
    end.setDate(end.getDate() + 1);
    return chartOrders
      .filter(
        (order) =>
          new Date(order.created_at) >= day && new Date(order.created_at) < end,
      )
      .reduce(
        (sum, order) =>
          sum + Number(order.amount_paid) - Number(order.amount_refunded),
        0,
      );
  });
  const chartTotal = chartOrders.reduce(
    (sum, order) =>
      sum + Number(order.amount_paid) - Number(order.amount_refunded),
    0,
  );
  const kpis = [
    [
      "TODAY’S SALES",
      loading ? "—" : `GHS ${todaySales.toLocaleString()}`,
      "Paid less refunds",
      "",
    ],
    [
      "NEW SHOP ORDERS",
      loading
        ? "—"
        : String(
            data.orders.filter(
              (o) =>
                o.order_type === "store_purchase" &&
                new Date(o.created_at) >=
                  new Date(new Date().setHours(0, 0, 0, 0)),
            ).length,
          ),
      "Today",
      "lime",
    ],
    [
      "NEW REQUESTS",
      loading ? "—" : String(requestCount),
      "Design requests",
      "",
    ],
    [
      "URGENT ORDERS",
      loading ? "—" : String(urgentCount),
      "Open orders",
      urgentCount ? "red" : "",
    ],
    [
      "LOW STOCK",
      loading ? "—" : String(lowStockCount),
      "Published items · under 5",
      lowStockCount ? "red" : "",
    ],
  ];
  const queueItems = (items: AdminOrder[]) =>
    items.map((order) => [
      order.order_code,
      `${order.customer_name} · ${order.status.replaceAll("_", " ")}`,
    ]);
  const greeting =
    new Date().getHours() < 12
      ? "Good morning"
      : new Date().getHours() < 18
        ? "Good afternoon"
        : "Good evening";
  return (
    <>
      <PageHead
        eyebrow={new Date()
          .toLocaleDateString(undefined, {
            weekday: "long",
            day: "2-digit",
            month: "short",
          })
          .toUpperCase()}
        title={`${greeting}, ${data.preferences?.owner_name || "WearWise owner"}.`}
        action={loading ? "" : "Refresh data"}
        onAction={onRefresh}
      />
      <div className="kpi-grid">
        {kpis.map((k) => (
          <div className="kpi" key={k[0]}>
            <div>
              <span>{k[0]}</span>
            </div>
            <strong>{k[1]}</strong>
            <small className={k[3]}>{k[2]}</small>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="a-panel queue">
          <PanelHead
            title="Quick action queue"
            meta={`${needsQuote.length + needsSourcing.length + proofs.length} tasks`}
          />
          {needsQuote.length + needsSourcing.length + proofs.length ? (
            <>
              <Queue
                title="NEEDS QUOTE"
                count={needsQuote.length}
                items={queueItems(needsQuote)}
                onOpen={() => go("requests")}
              />
              <Queue
                title="NEEDS SOURCING"
                count={needsSourcing.length}
                items={queueItems(needsSourcing)}
                onOpen={() => go("orders")}
              />
              <Queue
                title="PROOF TO SEND"
                count={proofs.length}
                items={queueItems(proofs)}
                onOpen={() => go("requests")}
              />
            </>
          ) : (
            <p className="admin-empty-state">No orders need attention.</p>
          )}
        </section>
        <section className="a-panel revenue">
          <PanelHead
            title="Revenue"
            meta={`GHS ${chartTotal.toLocaleString()} ${chartPeriod.toLowerCase()}`}
          />
          <div className="chart-tabs">
            {["Today", "Week", "Month", "Year"].map((x) => (
              <button
                className={chartPeriod === x ? "active" : ""}
                key={x}
                onClick={() => setChartPeriod(x)}
              >
                {x}
              </button>
            ))}
          </div>
          {chartTotal > 0 ? (
            <LineChart values={chartValues} />
          ) : (
            <p className="admin-empty-state">
              Paid revenue will appear here when orders are recorded.
            </p>
          )}
          <div className="chart-axis">
            {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
        </section>
      </div>
      <section className="a-panel activity">
        <PanelHead
          title="Recent activity"
          meta={loading ? "" : "Live"}
        />
        <div className="admin-live-table-wrap">
          <table>
            <thead>
              <tr>
                <th>EVENT</th>
                <th>CODE</th>
                <th>CUSTOMER</th>
                <th>VALUE</th>
                <th>TIME</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((order) => (
                <tr key={order.id}>
                  <td>
                    <i
                      className={`event-dot ${order.payment_status === "paid" ? "sale" : order.order_type === "store_purchase" ? "dark" : "request"}`}
                    />
                    {order.payment_status === "paid"
                      ? "Payment received"
                      : order.status.replaceAll("_", " ")}
                  </td>
                  <td>
                    <b>{order.order_code}</b>
                  </td>
                  <td>{order.customer_name}</td>
                  <td>
                    {order.total_amount
                      ? `GHS ${Number(order.total_amount).toLocaleString()}`
                      : "Pending"}
                  </td>
                  <td>{new Date(order.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && recent.length === 0 && (
            <p className="admin-empty-state">
              No orders recorded yet. New customer orders will appear here.
            </p>
          )}
        </div>
      </section>
      <div className="admin-dashboard-foot">
        <span>Signed in to Supabase as the WearWise owner</span>
        <button onClick={onRefresh}>Refresh live data ↻</button>
      </div>
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
function PanelHead({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="panel-head">
      <h2>{title}</h2>
      {meta && <span>{meta}</span>}
    </div>
  );
}
function Queue({
  title,
  count,
  items,
  onOpen,
}: {
  title: string;
  count: number;
  items: string[][];
  onOpen: () => void;
}) {
  return (
    <div className="queue-group">
      <div className="queue-title">
        <span>{title}</span>
        <b>{count}</b>
      </div>
      {items.map((item) => (
        <button
          type="button"
          className="admin-queue-row"
          onClick={onOpen}
          key={item[0]}
        >
          <div>
            <strong>{item[0]}</strong>
            <small>{item[1]}</small>
          </div>
          <span>OPEN →</span>
        </button>
      ))}
    </div>
  );
}
function LineChart({ values }: { values: number[] }) {
  const total = values.reduce((sum, value) => sum + value, 0),
    max = Math.max(1, ...values),
    points = values
      .map(
        (value, index) =>
          `${(index * 600) / Math.max(1, values.length - 1)},${190 - (value / max) * 150}`,
      )
      .join(" ");
  return (
    <div className="line-chart">
      <div className="chart-grid" />
      <svg viewBox="0 0 600 220" preserveAspectRatio="none">
        <defs>
          <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c8ff00" stopOpacity=".35" />
            <stop offset="1" stopColor="#c8ff00" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline className="area" points={`${points} 600,220 0,220`} />
        <polyline className="line" points={points} />
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
        <small>RECEIVED SALES</small>
        <strong>GHS {total.toLocaleString()}</strong>
      </div>
    </div>
  );
}
export default Admin;
