import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    type TextInputProps,
    View,
    useWindowDimensions,
} from "react-native";
import { supabase } from "../lib/supabase";

const ADMIN_USER_ID = "c219bece-37e4-4357-a61d-0cb75674ed4c";

type Category = "T-shirts" | "Jerseys";
type PriceMode = "quote" | "starting_at" | "fixed";

type Product = {
  id: string;
  name: string;
  category: Category;
  description: string;
  display_price: number | string | null;
  price_mode: PriceMode;
  currency_code: string;
  usual_sizes: string[];
  usual_colors: string[];
  is_active: boolean;
  estimated_shirt_cost: number | string | null;
  estimated_printing_cost: number | string | null;
};

type StoreItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number | string;
  currency_code: string;
  image_paths: string[];
  size_options: string[];
  color_options: string[];
  is_available: boolean;
  stock_quantity: number | null;
  is_published: boolean;
  purchase_cost: number | string | null;
  other_cost: number | string | null;
};

type StoreItemRow = Omit<StoreItem, "purchase_cost" | "other_cost">;

type ProductRow = Omit<
  Product,
  "estimated_shirt_cost" | "estimated_printing_cost"
>;

type CostRow = {
  product_id: string;
  estimated_shirt_cost: number | string | null;
  estimated_printing_cost: number | string | null;
};

type OrderStatus =
  | "request_received"
  | "awaiting_payment"
  | "paid"
  | "design_in_progress"
  | "proof_sent"
  | "revision_requested"
  | "proof_approved"
  | "sourcing"
  | "alternative_offered"
  | "refund_pending"
  | "refunded"
  | "in_production"
  | "ready_for_handoff"
  | "out_for_delivery"
  | "delivered"
  | "completed"
  | "cancelled";

type OrderItem = {
  id: string;
  order_id: string;
  product_name_snapshot: string;
  category_snapshot: string | null;
  requested_size: string | null;
  requested_color: string | null;
  quantity: number;
  quoted_unit_price: number | string;
  estimated_unit_cost: number | string | null;
  actual_unit_cost: number | string;
  customization_details: Record<string, unknown>;
};

type OrderPayment = {
  id: string;
  order_id: string;
  transaction_type: "payment" | "refund";
  status: string;
  provider: string | null;
  payment_method: string | null;
  provider_reference: string | null;
  amount: number | string;
  currency_code: string;
  confirmed_at: string | null;
  notes: string | null;
  created_at: string;
};

type Order = {
  id: string;
  order_code: string;
  order_type: "existing_design" | "custom_design" | "store_purchase";
  status: OrderStatus;
  payment_status: string;
  availability_confirmed_at: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  delivery_method: string | null;
  delivery_area: string | null;
  delivery_address: string | null;
  delivery_instructions: string | null;
  customer_request: string | null;
  customer_artwork_path: string | null;
  estimated_delivery_date: string | null;
  currency_code: string;
  subtotal: number | string;
  discount_amount: number | string;
  delivery_fee: number | string;
  rush_days_early: number;
  rush_fee: number | string;
  total_amount: number | string;
  amount_paid: number | string;
  amount_refunded: number | string;
  actual_sourcing_cost: number | string;
  actual_printing_cost: number | string;
  actual_delivery_cost: number | string;
  actual_payment_fee: number | string;
  actual_other_cost: number | string;
  actual_costs_recorded_at: string | null;
  admin_notes: string | null;
  created_at: string;
  items: OrderItem[];
  payments: OrderPayment[];
};

type OrderFilter = "all" | "needs_attention" | "in_progress" | "completed";
type AdminSection = "overview" | "orders" | "shop" | "catalog";

const statusLabel = (status: string) =>
  status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const nextStatuses: Partial<Record<OrderStatus, OrderStatus[]>> = {
  request_received: ["cancelled"],
  awaiting_payment: ["cancelled"],
  paid: ["design_in_progress", "sourcing"],
  design_in_progress: ["proof_sent"],
  proof_sent: ["proof_approved", "revision_requested"],
  revision_requested: ["design_in_progress"],
  proof_approved: ["sourcing"],
  sourcing: ["alternative_offered", "in_production"],
  alternative_offered: ["sourcing", "refund_pending"],
  refund_pending: ["sourcing"],
  in_production: ["ready_for_handoff"],
  ready_for_handoff: ["out_for_delivery", "delivered"],
  out_for_delivery: ["delivered"],
  delivered: ["completed"],
};

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: TextInputProps["keyboardType"];
  secureTextEntry?: boolean;
  autoCapitalize?: TextInputProps["autoCapitalize"];
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  secureTextEntry,
  autoCapitalize,
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#888888"
        multiline={multiline}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize ?? "sentences"}
        style={[styles.input, multiline && styles.multilineInput]}
      />
    </View>
  );
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  return Number(value);
}

function formatMoney(value: number | string | null) {
  if (value === null || value === "") return "Not set";
  return `GHS ${Number(value).toFixed(2)}`;
}

export default function AdminScreen() {
  const { width } = useWindowDimensions();
  const pageMotion = useRef(new Animated.Value(0)).current;
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [working, setWorking] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [loadingStoreItems, setLoadingStoreItems] = useState(false);
  const [storeWorking, setStoreWorking] = useState(false);
  const [storeUploadingImage, setStoreUploadingImage] = useState(false);
  const [storeEditingId, setStoreEditingId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");
  const [storeCategory, setStoreCategory] = useState("T-shirts");
  const [storeDescription, setStoreDescription] = useState("");
  const [storeSizes, setStoreSizes] = useState("");
  const [storeColors, setStoreColors] = useState("");
  const [storePrice, setStorePrice] = useState("");
  const [storePurchaseCost, setStorePurchaseCost] = useState("");
  const [storeOtherCost, setStoreOtherCost] = useState("");
  const [storeStockQuantity, setStoreStockQuantity] = useState("");
  const [campusDeliveryFee, setCampusDeliveryFee] = useState("0");
  const [sisterDeliveryFee, setSisterDeliveryFee] = useState("0");
  const [courierDeliveryFee, setCourierDeliveryFee] = useState("");
  const [otherDeliveryFee, setOtherDeliveryFee] = useState("");
  const [freeDeliveryAreas, setFreeDeliveryAreas] = useState("");
  const [savingDeliveryFees, setSavingDeliveryFees] = useState(false);
  const [storeImagePaths, setStoreImagePaths] = useState<string[]>([]);
  const [storeAvailable, setStoreAvailable] = useState(true);
  const [storePublished, setStorePublished] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const [transactionOrderId, setTransactionOrderId] = useState<string | null>(null);
  const [transactionType, setTransactionType] = useState<"payment" | "refund" | null>(null);
  const [transactionAmount, setTransactionAmount] = useState("");
  const [transactionMethod, setTransactionMethod] = useState("");
  const [transactionReference, setTransactionReference] = useState("");
  const [transactionNotes, setTransactionNotes] = useState("");
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [quoteOrderId, setQuoteOrderId] = useState<string | null>(null);
  const [paymentLinkOrderId, setPaymentLinkOrderId] = useState<string | null>(null);
  const [availabilityConfirmed, setAvailabilityConfirmed] = useState(false);
  const [quoteSubtotal, setQuoteSubtotal] = useState("");
  const [quoteDiscount, setQuoteDiscount] = useState("");
  const [quoteDeliveryFee, setQuoteDeliveryFee] = useState("");
  const [quoteRushDays, setQuoteRushDays] = useState("");
  const [costOrderId, setCostOrderId] = useState<string | null>(null);
  const [actualSourcingCost, setActualSourcingCost] = useState("");
  const [actualPrintingCost, setActualPrintingCost] = useState("");
  const [actualDeliveryCost, setActualDeliveryCost] = useState("");
  const [actualPaymentFee, setActualPaymentFee] = useState("");
  const [actualOtherCost, setActualOtherCost] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("T-shirts");
  const [description, setDescription] = useState("");
  const [displayPrice, setDisplayPrice] = useState("");
  const [priceMode, setPriceMode] = useState<PriceMode>("quote");
  const [sizes, setSizes] = useState("");
  const [colors, setColors] = useState("");
  const [shirtCost, setShirtCost] = useState("");
  const [printingCost, setPrintingCost] = useState("");
  const [isActive, setIsActive] = useState(false);

  async function loadProducts() {
    setLoadingProducts(true);
    setError(null);

    const [
      { data: productData, error: productError },
      { data: costData, error: costError },
    ] = await Promise.all([
      supabase
        .from("products")
        .select(
          "id, name, category, description, display_price, price_mode, currency_code, usual_sizes, usual_colors, is_active",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("product_cost_estimates")
        .select("product_id, estimated_shirt_cost, estimated_printing_cost"),
    ]);

    if (productError) {
      setError(productError.message);
      setLoadingProducts(false);
      return;
    }

    if (costError) {
      setError(costError.message);
      setLoadingProducts(false);
      return;
    }

    const costsByProduct = new Map<string, CostRow>(
      ((costData ?? []) as CostRow[]).map((cost) => [cost.product_id, cost]),
    );

    const rows = (productData ?? []) as ProductRow[];

    setProducts(
      rows.map((product) => {
        const costs = costsByProduct.get(product.id);

        return {
          ...product,
          estimated_shirt_cost: costs?.estimated_shirt_cost ?? null,
          estimated_printing_cost: costs?.estimated_printing_cost ?? null,
        };
      }),
    );

    setLoadingProducts(false);
  }

  async function loadStoreItems() {
    setLoadingStoreItems(true);
    const [
      { data: itemData, error: itemError },
      { data: costData, error: costError },
    ] = await Promise.all([
      supabase
        .from("store_items")
        .select("id, name, category, description, price, currency_code, image_paths, size_options, color_options, is_available, stock_quantity, is_published")
        .order("created_at", { ascending: false }),
      supabase
        .from("store_item_costs")
        .select("store_item_id, purchase_cost, other_cost"),
    ]);

    const loadError = itemError ?? costError;
    if (loadError) {
      setError(loadError.message);
      setLoadingStoreItems(false);
      return;
    }

    const costsByItem = new Map<string, { purchase_cost: number | string | null; other_cost: number | string | null }>(
      (costData ?? []).map((row) => [row.store_item_id, row] as const),
    );
    setStoreItems(((itemData ?? []) as StoreItemRow[]).map((item) => ({
      ...item,
      purchase_cost: costsByItem.get(item.id)?.purchase_cost ?? null,
      other_cost: costsByItem.get(item.id)?.other_cost ?? null,
    })));
    setLoadingStoreItems(false);
  }

  async function loadStoreDeliverySettings() {
    const { data, error: settingsError } = await supabase
      .from("store_delivery_settings")
      .select("campus_handoff_fee, sister_office_handoff_fee, courier_fee, other_fee, free_delivery_areas")
      .eq("singleton", true)
      .maybeSingle();
    if (settingsError) {
      setError(settingsError.message);
      return;
    }
    if (!data) return;
    setCampusDeliveryFee(String(data.campus_handoff_fee));
    setSisterDeliveryFee(String(data.sister_office_handoff_fee));
    setCourierDeliveryFee(data.courier_fee === null ? "" : String(data.courier_fee));
    setOtherDeliveryFee(data.other_fee === null ? "" : String(data.other_fee));
    setFreeDeliveryAreas((data.free_delivery_areas ?? []).join(", "));
  }

  async function loadOrders() {
    setLoadingOrders(true);

    const [
      { data: orderData, error: orderError },
      { data: itemData, error: itemError },
      { data: paymentData, error: paymentError },
    ] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "id, order_code, order_type, status, payment_status, availability_confirmed_at, customer_name, customer_phone, customer_email, delivery_method, delivery_area, delivery_address, delivery_instructions, customer_request, customer_artwork_path, estimated_delivery_date, currency_code, subtotal, discount_amount, delivery_fee, rush_days_early, rush_fee, total_amount, amount_paid, amount_refunded, actual_sourcing_cost, actual_printing_cost, actual_delivery_cost, actual_payment_fee, actual_other_cost, actual_costs_recorded_at, admin_notes, created_at",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("order_items")
        .select(
          "id, order_id, product_name_snapshot, category_snapshot, requested_size, requested_color, quantity, quoted_unit_price, estimated_unit_cost, actual_unit_cost, customization_details",
        ),
      supabase
        .from("order_payments")
        .select(
          "id, order_id, transaction_type, status, provider, payment_method, provider_reference, amount, currency_code, confirmed_at, notes, created_at",
        )
        .order("created_at", { ascending: false }),
    ]);

    const loadError = orderError ?? itemError ?? paymentError;
    if (loadError) {
      setError(loadError.message);
      setLoadingOrders(false);
      return;
    }

    const itemsByOrder = new Map<string, OrderItem[]>();
    for (const item of (itemData ?? []) as OrderItem[]) {
      const currentItems = itemsByOrder.get(item.order_id) ?? [];
      currentItems.push(item);
      itemsByOrder.set(item.order_id, currentItems);
    }

    const paymentsByOrder = new Map<string, OrderPayment[]>();
    for (const payment of (paymentData ?? []) as OrderPayment[]) {
      const currentPayments = paymentsByOrder.get(payment.order_id) ?? [];
      currentPayments.push(payment);
      paymentsByOrder.set(payment.order_id, currentPayments);
    }

    setOrders(
      ((orderData ?? []) as Omit<Order, "items" | "payments">[]).map((order) => ({
        ...order,
        items: itemsByOrder.get(order.id) ?? [],
        payments: paymentsByOrder.get(order.id) ?? [],
      })),
    );
    setLoadingOrders(false);
  }

  useEffect(() => {
    Animated.spring(pageMotion, {
      toValue: 1,
      damping: 19,
      stiffness: 85,
      useNativeDriver: true,
    }).start();

    let stillMounted = true;

    async function checkSession() {
      const { data } = await supabase.auth.getSession();

      if (!stillMounted) return;

      const user = data.session?.user;

      if (user?.id === ADMIN_USER_ID) {
        setAdminEmail(user.email ?? "WearWise owner");
        void loadProducts();
        void loadStoreItems();
        void loadStoreDeliverySettings();
        void loadOrders();
      } else if (user) {
        void supabase.auth.signOut();
      }

      setCheckingSession(false);
    }

    void checkSession();

    return () => {
      stillMounted = false;
    };
  }, [pageMotion]);

  function clearForm() {
    setEditingId(null);
    setName("");
    setCategory("T-shirts");
    setDescription("");
    setDisplayPrice("");
    setPriceMode("quote");
    setSizes("");
    setColors("");
    setShirtCost("");
    setPrintingCost("");
    setIsActive(false);
    setError(null);
    setMessage(null);
  }

  function editProduct(product: Product) {
    setEditingId(product.id);
    setName(product.name);
    setCategory(product.category);
    setDescription(product.description);
    setDisplayPrice(
      product.display_price === null ? "" : String(product.display_price),
    );
    setPriceMode(product.price_mode);
    setSizes(product.usual_sizes.join(", "));
    setColors(product.usual_colors.join(", "));
    setShirtCost(
      product.estimated_shirt_cost === null
        ? ""
        : String(product.estimated_shirt_cost),
    );
    setPrintingCost(
      product.estimated_printing_cost === null
        ? ""
        : String(product.estimated_printing_cost),
    );
    setIsActive(product.is_active);
    setError(null);
    setMessage(null);
  }

  async function saveProduct() {
    setError(null);
    setMessage(null);

    if (!name.trim()) {
      setError("Please enter a product name.");
      return;
    }

    if (
      displayPrice.trim() &&
      (!Number.isFinite(Number(displayPrice)) || Number(displayPrice) < 0)
    ) {
      setError("Enter a valid customer price, or leave it blank.");
      return;
    }

    if (
      (priceMode === "fixed" || priceMode === "starting_at") &&
      !displayPrice.trim()
    ) {
      setError("Enter a customer price or choose “Quote before payment”.");
      return;
    }

    for (const [label, value] of [
      ["Shirt cost", shirtCost],
      ["Printing cost", printingCost],
    ]) {
      if (
        value.trim() &&
        (!Number.isFinite(Number(value)) || Number(value) < 0)
      ) {
        setError(`${label} must be a valid amount or left blank.`);
        return;
      }
    }

    setWorking(true);

    const productValues = {
      name: name.trim(),
      category,
      description: description.trim(),
      display_price: numberOrNull(displayPrice),
      price_mode: priceMode,
      currency_code: "GHS",
      usual_sizes: splitList(sizes),
      usual_colors: splitList(colors),
      is_active: isActive,
      updated_at: new Date().toISOString(),
    };

    let savedProduct: ProductRow | null = null;
    let saveError: string | null = null;

    if (editingId) {
      const { data, error: updateError } = await supabase
        .from("products")
        .update(productValues)
        .eq("id", editingId)
        .select(
          "id, name, category, description, display_price, price_mode, currency_code, usual_sizes, usual_colors, is_active",
        )
        .single();

      if (updateError) {
        saveError = updateError.message;
      } else {
        savedProduct = data as ProductRow;
      }
    } else {
      const { data, error: insertError } = await supabase
        .from("products")
        .insert(productValues)
        .select(
          "id, name, category, description, display_price, price_mode, currency_code, usual_sizes, usual_colors, is_active",
        )
        .single();

      if (insertError) {
        saveError = insertError.message;
      } else {
        savedProduct = data as ProductRow;
      }
    }

    if (saveError || !savedProduct) {
      setError(saveError ?? "Could not save the product.");
      setWorking(false);
      return;
    }

    const { error: costError } = await supabase
      .from("product_cost_estimates")
      .upsert(
        {
          product_id: savedProduct.id,
          estimated_shirt_cost: numberOrNull(shirtCost),
          estimated_printing_cost: numberOrNull(printingCost),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "product_id" },
      );

    if (costError) {
      setError(
        `Product saved, but its private cost estimates were not saved: ${costError.message}`,
      );
      await loadProducts();
      setWorking(false);
      return;
    }

    setMessage(editingId ? "Product updated." : "Product added.");
    clearForm();
    await loadProducts();
    setWorking(false);
  }

  async function toggleProduct(product: Product) {
    setError(null);
    setMessage(null);

    const { error: updateError } = await supabase
      .from("products")
      .update({
        is_active: !product.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", product.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage(
      product.is_active
        ? "Product hidden from the catalog."
        : "Product marked active.",
    );
    await loadProducts();
  }

  function clearStoreForm() {
    setStoreEditingId(null);
    setStoreName("");
    setStoreCategory("T-shirts");
    setStoreDescription("");
    setStoreSizes("");
    setStoreColors("");
    setStorePrice("");
    setStorePurchaseCost("");
    setStoreOtherCost("");
    setStoreStockQuantity("");
    setStoreImagePaths([]);
    setStoreAvailable(true);
    setStorePublished(false);
  }

  function editStoreItem(item: StoreItem) {
    setStoreEditingId(item.id);
    setStoreName(item.name);
    setStoreCategory(item.category);
    setStoreDescription(item.description);
    setStoreSizes((item.size_options ?? []).join(", "));
    setStoreColors((item.color_options ?? []).join(", "));
    setStorePrice(String(item.price));
    setStorePurchaseCost(item.purchase_cost === null ? "" : String(item.purchase_cost));
    setStoreOtherCost(item.other_cost === null ? "" : String(item.other_cost));
    setStoreStockQuantity(item.stock_quantity === null ? "" : String(item.stock_quantity));
    setStoreImagePaths(item.image_paths ?? []);
    setStoreAvailable(item.is_available);
    setStorePublished(item.is_published);
    setError(null);
    setMessage(null);
  }

  function chooseStoreImage() {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      setError("Please open the admin page on the WearWise website to upload product photos.");
      return;
    }
    if (storeImagePaths.length >= 5) {
      setError("Each item can have up to five photos.");
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setError("Choose a JPG, PNG, or WebP photo.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("Each photo must be 5 MB or smaller.");
        return;
      }

      void (async () => {
        setStoreUploadingImage(true);
        setError(null);
        const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
        const objectPath = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${extension}`;
        const { data, error: uploadError } = await supabase.storage
          .from("store-items")
          .upload(objectPath, file, {
            cacheControl: "3600",
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          setError(uploadError.message);
        } else {
          setStoreImagePaths((paths) => [...paths, data.path]);
          setMessage("Photo uploaded. Save the item to add it to the shop.");
        }
        setStoreUploadingImage(false);
      })();
    };
    input.click();
  }

  async function saveStoreItem() {
    const price = Number(storePrice);
    const purchaseCost = numberOrNull(storePurchaseCost);
    const otherCost = numberOrNull(storeOtherCost);
    const stockQuantity = storeStockQuantity.trim() ? Number(storeStockQuantity) : null;
    setError(null);
    setMessage(null);

    if (!storeName.trim() || !storeCategory.trim()) {
      setError("Enter an item name and category.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError("Enter a customer price greater than zero.");
      return;
    }
    if ([purchaseCost, otherCost].some((value) => value !== null && (!Number.isFinite(value) || value < 0))) {
      setError("Cost amounts must be zero or higher.");
      return;
    }
    if (stockQuantity !== null && (!Number.isInteger(stockQuantity) || stockQuantity < 0)) {
      setError("Stock quantity must be a whole number or left blank if you are not tracking a count.");
      return;
    }

    setStoreWorking(true);
    const values = {
      name: storeName.trim(),
      category: storeCategory.trim(),
      description: storeDescription.trim(),
      size_options: splitList(storeSizes),
      color_options: splitList(storeColors),
      price,
      currency_code: "GHS",
      image_paths: storeImagePaths,
      is_available: storeAvailable,
      stock_quantity: stockQuantity,
      is_published: storePublished,
      updated_at: new Date().toISOString(),
    };

    const saveResult = storeEditingId
      ? await supabase.from("store_items").update(values).eq("id", storeEditingId).select("id").single()
      : await supabase.from("store_items").insert(values).select("id").single();

    if (saveResult.error || !saveResult.data) {
      setError(saveResult.error?.message ?? "Could not save this shop item.");
      setStoreWorking(false);
      return;
    }

    const { error: costError } = await supabase.from("store_item_costs").upsert(
      {
        store_item_id: saveResult.data.id,
        purchase_cost: purchaseCost,
        other_cost: otherCost,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "store_item_id" },
    );

    if (costError) {
      setError(`Item saved, but private costs were not saved: ${costError.message}`);
      await loadStoreItems();
      setStoreWorking(false);
      return;
    }

    const wasEditing = Boolean(storeEditingId);
    clearStoreForm();
    setMessage(wasEditing ? "Shop item updated." : "Shop item added.");
    await loadStoreItems();
    setStoreWorking(false);
  }

  async function toggleStoreItem(item: StoreItem, field: "is_available" | "is_published") {
    setError(null);
    setMessage(null);
    const { error: updateError } = await supabase
      .from("store_items")
      .update({ [field]: !item[field], updated_at: new Date().toISOString() })
      .eq("id", item.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setMessage(field === "is_available"
      ? item.is_available ? "Item marked unavailable." : "Item marked available."
      : item.is_published ? "Item hidden from the shop." : "Item published in the shop.");
    await loadStoreItems();
  }

  async function saveStoreDeliverySettings() {
    const fixedFees = [campusDeliveryFee, sisterDeliveryFee, courierDeliveryFee, otherDeliveryFee];
    if (fixedFees.some((value) => value.trim() && (!Number.isFinite(Number(value)) || Number(value) < 0))) {
      setError("Enter valid delivery fees in GHS, or leave an unavailable method blank.");
      return;
    }
    setSavingDeliveryFees(true);
    setError(null);
    setMessage(null);
    const { error: saveError } = await supabase
      .from("store_delivery_settings")
      .update({
        campus_handoff_fee: Number(campusDeliveryFee || 0),
        sister_office_handoff_fee: Number(sisterDeliveryFee || 0),
        courier_fee: numberOrNull(courierDeliveryFee),
        other_fee: numberOrNull(otherDeliveryFee),
        free_delivery_areas: splitList(freeDeliveryAreas),
        updated_at: new Date().toISOString(),
      })
      .eq("singleton", true);
    if (saveError) setError(saveError.message);
    else setMessage("Shop delivery fees updated.");
    setSavingDeliveryFees(false);
  }

  async function signIn() {
    setWorking(true);
    setError(null);

    const { data, error: signInError } = await supabase.auth.signInWithPassword(
      {
        email: email.trim(),
        password,
      },
    );

    if (signInError) {
      setError(signInError.message);
      setWorking(false);
      return;
    }

    if (data.user.id !== ADMIN_USER_ID) {
      await supabase.auth.signOut();
      setError("This account does not have WearWise owner access.");
      setWorking(false);
      return;
    }

    pageMotion.setValue(0);
    setAdminEmail(data.user.email ?? "WearWise owner");
    Animated.spring(pageMotion, {
      toValue: 1,
      damping: 19,
      stiffness: 85,
      useNativeDriver: true,
    }).start();
    setPassword("");
    await Promise.all([loadProducts(), loadStoreItems(), loadStoreDeliverySettings(), loadOrders()]);
    setWorking(false);
  }

  function openTransactionForm(order: Order, type: "payment" | "refund") {
    setTransactionOrderId(order.id);
    setTransactionType(type);
    setTransactionAmount(
      type === "payment"
        ? Math.max(0, Number(order.total_amount) - Number(order.amount_paid)).toFixed(2)
        : Math.max(0, Number(order.amount_paid) - Number(order.amount_refunded)).toFixed(2),
    );
    setTransactionMethod("Mobile Money");
    setTransactionReference("");
    setTransactionNotes("");
    setError(null);
    setMessage(null);
  }

  function openQuoteForm(order: Order) {
    setQuoteOrderId(order.id);
    setQuoteSubtotal(String(order.subtotal));
    setQuoteDiscount(String(order.discount_amount));
    setQuoteDeliveryFee(String(order.delivery_fee));
    setQuoteRushDays(String(order.rush_days_early));
    setAvailabilityConfirmed(Boolean(order.availability_confirmed_at));
    setError(null);
    setMessage(null);
  }

  function openActualCostForm(order: Order) {
    setCostOrderId(order.id);
    setActualSourcingCost(order.actual_costs_recorded_at ? String(order.actual_sourcing_cost) : "");
    setActualPrintingCost(order.actual_costs_recorded_at ? String(order.actual_printing_cost) : "");
    setActualDeliveryCost(order.actual_costs_recorded_at ? String(order.actual_delivery_cost) : "");
    setActualPaymentFee(order.actual_costs_recorded_at ? String(order.actual_payment_fee) : "");
    setActualOtherCost(order.actual_costs_recorded_at ? String(order.actual_other_cost) : "");
    setError(null);
    setMessage(null);
  }

  async function saveActualCosts(order: Order) {
    const values = [actualSourcingCost, actualPrintingCost, actualDeliveryCost, actualPaymentFee, actualOtherCost];
    if (values.some((value) => !value.trim() || !Number.isFinite(Number(value)) || Number(value) < 0)) {
      setError("Enter each actual cost, using 0 for any cost that did not apply.");
      return;
    }
    setUpdatingOrderId(order.id);
    setError(null);
    setMessage(null);
    const { error: updateError } = await supabase.from("orders").update({
      actual_sourcing_cost: Number(actualSourcingCost),
      actual_printing_cost: Number(actualPrintingCost),
      actual_delivery_cost: Number(actualDeliveryCost),
      actual_payment_fee: Number(actualPaymentFee),
      actual_other_cost: Number(actualOtherCost),
      actual_costs_recorded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", order.id);
    if (updateError) {
      setError(updateError.message);
      setUpdatingOrderId(null);
      return;
    }
    setCostOrderId(null);
    setMessage(`Actual costs saved for ${order.order_code}.`);
    await loadOrders();
    setUpdatingOrderId(null);
  }

  async function saveQuote(order: Order) {
    const subtotal = Number(quoteSubtotal);
    const discount = Number(quoteDiscount || 0);
    const deliveryFee = Number(quoteDeliveryFee || 0);
    const rushDays = Number(quoteRushDays || 0);
    const values = [subtotal, discount, deliveryFee, rushDays];

    if (order.order_type === "custom_design" && !availabilityConfirmed) {
      setError("Confirm that you can source the requested size and colour and make the design before saving a quote.");
      return;
    }

    if (values.some((value) => !Number.isFinite(value) || value < 0) || !Number.isInteger(rushDays)) {
      setError("Check the quote amounts and urgent days. They must be valid positive numbers.");
      return;
    }
    const rushFee = Math.round(subtotal * 0.2 * rushDays * 100) / 100;
    const total = Math.round((subtotal - discount + deliveryFee + rushFee) * 100) / 100;
    if (total <= 0) {
      setError("The order total must be greater than zero.");
      return;
    }
    if (discount > subtotal) {
      setError("The discount cannot be greater than the subtotal.");
      return;
    }

    setUpdatingOrderId(order.id);
    setError(null);
    setMessage(null);
    const { error: quoteError } = await supabase
      .from("orders")
      .update({
        subtotal,
        discount_amount: discount,
        delivery_fee: deliveryFee,
        rush_days_early: rushDays,
        rush_fee: rushFee,
        total_amount: total,
        availability_confirmed_at: order.order_type === "custom_design"
          ? order.availability_confirmed_at ?? new Date().toISOString()
          : order.availability_confirmed_at,
        status: "awaiting_payment",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (quoteError) {
      setError(quoteError.message);
      setUpdatingOrderId(null);
      return;
    }
    setQuoteOrderId(null);
    setMessage(`Quote saved for ${order.order_code}. Confirm the price and payment steps with the customer on WhatsApp.`);
    await loadOrders();
    setUpdatingOrderId(null);
  }

  function contactCustomOrderOnWhatsApp(order: Order) {
    const phone = order.customer_phone.replace(/\D/g, "");
    if (!phone) {
      setError("This request has no usable phone number for WhatsApp.");
      return;
    }
    const paymentUrl = `${typeof window !== "undefined" ? window.location.origin : "https://wearwise-gold.vercel.app"}/pay?orderCode=${encodeURIComponent(order.order_code)}`;
    const requestedOptions = order.items.map((item) => `${item.requested_size || "size not specified"}, ${item.requested_color || "colour not specified"}`).join("; ");
    const message = `Hi ${order.customer_name.split(" ")[0]}, I’ve checked your WearWise request ${order.order_code}. I can source the requested T-shirt option (${requestedOptions}) and make this design. Your total is ${formatMoney(order.total_amount)}. If you’d like to go ahead, you can pay securely here: ${paymentUrl}. I’ll begin the design work after payment is confirmed.`;
    void Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`);
  }

  function closeTransactionForm() {
    setTransactionOrderId(null);
    setTransactionType(null);
    setTransactionAmount("");
    setTransactionMethod("");
    setTransactionReference("");
    setTransactionNotes("");
  }

  async function saveTransaction() {
    if (!transactionOrderId || !transactionType) return;
    const amount = Number(transactionAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid amount greater than zero.");
      return;
    }
    if (!transactionMethod.trim()) {
      setError("Enter the payment method used.");
      return;
    }

    setSavingTransaction(true);
    setError(null);
    setMessage(null);
    const rpcName = transactionType === "payment"
      ? "record_manual_order_payment"
      : "record_manual_order_refund";
    const { error: transactionError } = await supabase.rpc(rpcName, {
      p_order_id: transactionOrderId,
      p_amount: amount,
      p_payment_method: transactionMethod.trim(),
      p_provider_reference: transactionReference.trim() || null,
      p_notes: transactionNotes.trim() || null,
    });

    if (transactionError) {
      setError(transactionError.message);
      setSavingTransaction(false);
      return;
    }

    setMessage(transactionType === "payment" ? "Payment recorded." : "Refund recorded.");
    closeTransactionForm();
    await loadOrders();
    setSavingTransaction(false);
  }

  async function moveOrder(order: Order, status: OrderStatus) {
    setUpdatingOrderId(order.id);
    setError(null);
    setMessage(null);

    const values: { status: OrderStatus; payment_status?: string; updated_at: string } = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === "refund_pending") values.payment_status = "refund_pending";
    if (status === "sourcing" && order.payment_status === "refund_pending") {
      values.payment_status = Number(order.amount_paid) >= Number(order.total_amount) ? "paid" : "pending";
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update(values)
      .eq("id", order.id);

    if (updateError) {
      setError(updateError.message);
      setUpdatingOrderId(null);
      return;
    }

    setMessage(`${order.order_code} moved to ${statusLabel(status)}.`);
    await loadOrders();
    setUpdatingOrderId(null);
  }

  async function openCustomerArtwork(order: Order) {
    if (!order.customer_artwork_path) return;
    const { data, error: artworkError } = await supabase.storage
      .from("customer-artwork")
      .createSignedUrl(order.customer_artwork_path, 60);
    if (artworkError || !data?.signedUrl) {
      setError(artworkError?.message ?? "Could not open the customer artwork.");
      return;
    }
    await Linking.openURL(data.signedUrl);
  }

  const visibleOrders = orders.filter((order) => {
    const query = orderSearch.trim().toLowerCase();
    const matchesSearch = !query ||
      order.order_code.toLowerCase().includes(query) ||
      order.customer_name.toLowerCase().includes(query) ||
      order.customer_phone.toLowerCase().includes(query);
    const attentionStatuses: OrderStatus[] = [
      "request_received",
      "awaiting_payment",
      "alternative_offered",
      "refund_pending",
    ];
    const closedStatuses: OrderStatus[] = ["completed", "cancelled", "refunded"];
    const matchesFilter = orderFilter === "all" ||
      (orderFilter === "needs_attention" && attentionStatuses.includes(order.status)) ||
      (orderFilter === "completed" && closedStatuses.includes(order.status)) ||
      (orderFilter === "in_progress" && !closedStatuses.includes(order.status) && !attentionStatuses.includes(order.status));
    return matchesSearch && matchesFilter;
  });

  const analytics = useMemo(() => {
    const paidOrders = orders.filter((order) => Number(order.amount_paid) > 0);
    const collectedAfterRefunds = paidOrders.reduce(
      (sum, order) => sum + Math.max(0, Number(order.amount_paid) - Number(order.amount_refunded)),
      0,
    );
    const ordersWithCosts = paidOrders.filter((order) => order.actual_costs_recorded_at !== null);
    const knownRevenue = ordersWithCosts.reduce(
      (sum, order) => sum + Math.max(0, Number(order.amount_paid) - Number(order.amount_refunded)),
      0,
    );
    const knownCosts = ordersWithCosts.reduce((sum, order) => sum +
      Number(order.actual_sourcing_cost) + Number(order.actual_printing_cost) +
      Number(order.actual_delivery_cost) + Number(order.actual_payment_fee) +
      Number(order.actual_other_cost), 0);
    return {
      paidOrders: paidOrders.length,
      collectedAfterRefunds,
      knownProfit: knownRevenue - knownCosts,
      ordersWithCosts: ordersWithCosts.length,
      awaitingPayment: orders.filter((order) => order.status === "awaiting_payment").length,
    };
  }, [orders]);

  async function signOut() {
    setWorking(true);
    setError(null);

    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      setError(signOutError.message);
    } else {
      pageMotion.setValue(0);
      setAdminEmail(null);
      setProducts([]);
      setStoreItems([]);
      setOrders([]);
      clearForm();
      Animated.spring(pageMotion, {
        toValue: 1,
        damping: 19,
        stiffness: 85,
        useNativeDriver: true,
      }).start();
    }

    setWorking(false);
  }

  if (checkingSession) {
    return (
      <View style={styles.centeredPage}>
        <ActivityIndicator color={palette.plum} />
        <Text style={styles.loadingText}>Opening your workspace…</Text>
      </View>
    );
  }

  if (!adminEmail) {
    return (
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.loginPage}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={[
            styles.loginCard,
            {
              opacity: pageMotion,
              transform: [
                {
                  translateY: pageMotion.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.loginBrandRow}>
            <Image
              source={require("../assets/images/logo.png")}
              style={styles.loginLogo}
              resizeMode="contain"
            />
            <View>
              <Text style={styles.brand}>WearWise</Text>
              <Text style={styles.brandCaption}>OWNER WORKSPACE</Text>
            </View>
          </View>

          <View style={styles.loginAccent}>
            <Text style={styles.loginAccentMark}>W</Text>
          </View>
          <Text style={styles.loginEyebrow}>GOOD TO SEE YOU</Text>
          <Text style={styles.loginHeading}>Sign in to your studio.</Text>
          <Text style={styles.helpText}>
            Manage your WearWise products and keep your business moving.
          </Text>

          <View style={styles.loginForm}>
            <Field
              label="Email address"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={signIn}
            disabled={working || !email.trim() || !password}
            style={({ pressed }) => [
              styles.primaryButton,
              (working || !email.trim() || !password) && styles.disabledButton,
              pressed && styles.buttonPressed,
            ]}
          >
            {working ? (
              <ActivityIndicator color={palette.white} />
            ) : (
              <Text style={styles.primaryButtonText}>Sign in securely</Text>
            )}
            {!working ? <Text style={styles.primaryButtonArrow}>↗</Text> : null}
          </Pressable>
          <View style={styles.secureNote}>
            <Text style={styles.secureNoteIcon}>✓</Text>
            <Text style={styles.secureNoteText}>Private access for the WearWise owner</Text>
          </View>
        </Animated.View>
        <Text style={styles.loginFooter}>WEARWISE · MADE FOR YOUR EVERYDAY</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View
        style={[
          styles.dashboard,
          width >= 1024 && styles.dashboardWide,
          {
            opacity: pageMotion,
            transform: [
              {
                translateY: pageMotion.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              },
            ],
          },
        ]}
      >
      <View style={[styles.adminShell, width >= 1024 && styles.adminShellWide]}>
      <View style={[styles.adminSidebar, width >= 1024 && styles.adminSidebarWide, width < 1024 && styles.adminSidebarCompact]}>
        <View style={styles.dashboardBrand}>
          <Image
            source={require("../assets/images/logo.png")}
            style={styles.dashboardLogo}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.brand}>WearWise</Text>
            <Text style={styles.brandCaption}>OWNER WORKSPACE</Text>
          </View>
        </View>
        <Text style={styles.sidebarLabel}>WORKSPACE</Text>
        {([
          ["overview", "Overview", "⌂"],
          ["orders", "Orders & payments", "▤"],
          ["shop", "Shop inventory", "▣"],
          ["catalog", "Explore catalog", "◇"],
        ] as [AdminSection, string, string][]).map(([key, label, icon]) => (
          <Pressable key={key} onPress={() => setActiveSection(key)} style={[styles.sidebarLink, activeSection === key && styles.sidebarLinkActive]}>
            <Text style={[styles.sidebarIcon, activeSection === key && styles.sidebarIconActive]}>{icon}</Text>
            <Text style={[styles.sidebarLinkText, activeSection === key && styles.sidebarLinkTextActive]}>{label}</Text>
          </Pressable>
        ))}
        <View style={styles.sidebarSpacer} />
        <Pressable
          onPress={signOut}
          disabled={working}
          style={({ pressed }) => [styles.signOutButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.signOutButtonText}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.adminMain}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerKicker}>WEARWISE ADMIN</Text>
          <Text style={styles.headerTitle}>{({ overview: "Overview", orders: "Orders & payments", shop: "Shop inventory", catalog: "Explore catalog" })[activeSection]}</Text>
        </View>
        <Text style={styles.headerAccount}>{adminEmail}</Text>
      </View>

      {activeSection === "overview" ? <>
      <View style={styles.dashboardIntro}>
        <View style={styles.dashboardIntroCopy}>
          <Text style={styles.loginEyebrow}>BUSINESS SUMMARY</Text>
          <Text style={styles.dashboardTitle}>Good to see you.</Text>
          <Text style={styles.dashboardSubtitle}>Here’s how WearWise is doing today.</Text>
        </View>
        <View style={styles.dashboardSparkle}><Text style={styles.dashboardSparkleText}>W</Text></View>
      </View>

      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Collected after refunds</Text>
          <Text style={styles.metricValue}>{formatMoney(analytics.collectedAfterRefunds)}</Text>
          <Text style={styles.metricNote}>{analytics.paidOrders} order(s) with payment</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Known net profit</Text>
          <Text style={styles.metricValue}>{analytics.ordersWithCosts ? formatMoney(analytics.knownProfit) : "Add actual costs"}</Text>
          <Text style={styles.metricNote}>Costs recorded for {analytics.ordersWithCosts} paid order(s)</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Orders</Text>
          <Text style={styles.metricValue}>{orders.length}</Text>
          <Text style={styles.metricNote}>Shop and design requests</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Awaiting payment</Text>
          <Text style={styles.metricValue}>{analytics.awaitingPayment}</Text>
          <Text style={styles.metricNote}>Orders needing follow-up</Text>
        </View>
      </View>
      </> : null}

      {activeSection === "shop" ? <>
      <View style={styles.card}>
        <View style={styles.cardHeadingRow}>
          <View style={styles.cardHeadingIcon}><Text style={styles.cardHeadingIconText}>↗</Text></View>
          <View style={styles.cardHeadingCopy}>
            <Text style={styles.sectionEyebrow}>SHOP CHECKOUT</Text>
            <Text style={styles.heading}>Delivery prices</Text>
          </View>
        </View>
        <Text style={styles.helpText}>Set fixed delivery fees in GHS. Listed free areas override the courier fee when the customer enters a matching area.</Text>
        <Field label="Campus handoff fee (GHS)" value={campusDeliveryFee} onChangeText={setCampusDeliveryFee} keyboardType="decimal-pad" />
        <Field label="Sister’s office handoff fee (GHS)" value={sisterDeliveryFee} onChangeText={setSisterDeliveryFee} keyboardType="decimal-pad" />
        <Field label="Courier fee (GHS)" value={courierDeliveryFee} onChangeText={setCourierDeliveryFee} placeholder="Set a fee to enable courier checkout" keyboardType="decimal-pad" />
        <Field label="Other delivery fee (GHS)" value={otherDeliveryFee} onChangeText={setOtherDeliveryFee} placeholder="Optional" keyboardType="decimal-pad" />
        <Field label="Free delivery areas" value={freeDeliveryAreas} onChangeText={setFreeDeliveryAreas} placeholder="Separate area names with commas" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}
        <Pressable onPress={() => void saveStoreDeliverySettings()} disabled={savingDeliveryFees} style={[styles.primaryButton, savingDeliveryFees && styles.disabledButton]}>
          <Text style={styles.primaryButtonText}>{savingDeliveryFees ? "Saving…" : "Save delivery prices"}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeadingRow}>
          <View style={styles.cardHeadingIcon}><Text style={styles.cardHeadingIconText}>▣</Text></View>
          <View style={styles.cardHeadingCopy}>
            <Text style={styles.sectionEyebrow}>{storeEditingId ? "UPDATE THE SHOP" : "READY TO BUY"}</Text>
            <Text style={styles.heading}>{storeEditingId ? "Edit shop item" : "Add a shop item"}</Text>
          </View>
          <View style={styles.formStep}><Text style={styles.formStepText}>SHOP</Text></View>
        </View>
        <Text style={styles.helpText}>
          These items appear in the separate Shop. Add only things you have confirmed are currently available.
        </Text>
        <Field label="Item name" value={storeName} onChangeText={setStoreName} placeholder="For example: Classic white tee" />
        <Field label="Category" value={storeCategory} onChangeText={setStoreCategory} placeholder="T-shirts, Jerseys, Shoes…" />
        <Field label="Description" value={storeDescription} onChangeText={setStoreDescription} placeholder="Material, fit, colour, or other details" multiline />
        <Field label="Available sizes (optional)" value={storeSizes} onChangeText={setStoreSizes} placeholder="Example: S, M, L, XL" />
        <Field label="Available colours (optional)" value={storeColors} onChangeText={setStoreColors} placeholder="Example: Black, white, navy" />
        <Field label="Customer price (GHS)" value={storePrice} onChangeText={setStorePrice} placeholder="For example: 180" keyboardType="decimal-pad" />
        <Field label="Stock count (optional)" value={storeStockQuantity} onChangeText={setStoreStockQuantity} placeholder="Leave blank if you are not tracking a count" keyboardType="number-pad" />

        <View style={styles.privateCostHeader}>
          <Text style={styles.privateHeading}>Your item costs</Text>
          <View style={styles.privatePill}><Text style={styles.privatePillText}>PRIVATE</Text></View>
        </View>
        <Text style={styles.helpText}>Only you can see these numbers. We’ll use them for sales and profit reporting later.</Text>
        <Field label="Purchase cost (GHS)" value={storePurchaseCost} onChangeText={setStorePurchaseCost} placeholder="Optional" keyboardType="decimal-pad" />
        <Field label="Other cost (GHS)" value={storeOtherCost} onChangeText={setStoreOtherCost} placeholder="Optional" keyboardType="decimal-pad" />

        <Text style={styles.label}>Product photos</Text>
        <Text style={styles.helpText}>JPG, PNG, or WebP · up to 5 MB each · maximum 5 photos</Text>
        <Pressable onPress={chooseStoreImage} disabled={storeUploadingImage || storeImagePaths.length >= 5} style={styles.smallButton}>
          <Text style={styles.smallButtonText}>{storeUploadingImage ? "Uploading photo…" : "Choose and upload photo"}</Text>
        </Pressable>
        {storeImagePaths.length > 0 ? (
          <View style={styles.storePhotoRow}>
            {storeImagePaths.map((path) => (
              <View key={path} style={styles.storePhotoTile}>
                <Image source={{ uri: supabase.storage.from("store-items").getPublicUrl(path).data.publicUrl }} style={styles.storePhoto} />
                <Pressable onPress={() => setStoreImagePaths((paths) => paths.filter((itemPath) => itemPath !== path))} style={styles.storePhotoRemove}>
                  <Text style={styles.storePhotoRemoveText}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <Pressable onPress={() => setStoreAvailable((value) => !value)} style={styles.activeRow}>
          <View style={[styles.checkbox, storeAvailable && styles.checkboxChecked]}>{storeAvailable ? <Text style={styles.checkmark}>✓</Text> : null}</View>
          <Text style={styles.bodyText}>Available to order right now</Text>
        </Pressable>
        <Pressable onPress={() => setStorePublished((value) => !value)} style={styles.activeRow}>
          <View style={[styles.checkbox, storePublished && styles.checkboxChecked]}>{storePublished ? <Text style={styles.checkmark}>✓</Text> : null}</View>
          <Text style={styles.bodyText}>Show this item in the public Shop</Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}
        <Pressable onPress={() => void saveStoreItem()} disabled={storeWorking || storeUploadingImage} style={[styles.primaryButton, (storeWorking || storeUploadingImage) && styles.disabledButton]}>
          <Text style={styles.primaryButtonText}>{storeWorking ? "Saving…" : storeEditingId ? "Save shop item" : "Add to shop"}</Text>
        </Pressable>
        {storeEditingId ? <Pressable onPress={clearStoreForm} style={styles.cancelButton}><Text style={styles.cancelButtonText}>Cancel editing</Text></Pressable> : null}

        <View style={styles.storeInventoryHeading}>
          <Text style={styles.privateHeading}>Shop inventory</Text>
          <View style={styles.countPill}><Text style={styles.countPillText}>{storeItems.length}</Text></View>
        </View>
        {loadingStoreItems ? <ActivityIndicator color={palette.plum} /> : storeItems.length === 0 ? (
          <Text style={styles.helpText}>No shop items yet. Add your first ready-to-buy item above.</Text>
        ) : storeItems.map((item) => (
          <View key={item.id} style={styles.productCard}>
            <View style={styles.productTopRow}>
              {item.image_paths[0] ? <Image source={{ uri: supabase.storage.from("store-items").getPublicUrl(item.image_paths[0]).data.publicUrl }} style={styles.storeListImage} /> : null}
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{item.name}</Text>
                <View style={styles.categoryPill}><Text style={styles.categoryPillText}>{item.category}</Text></View>
              </View>
              <Text style={[styles.status, item.is_published && item.is_available ? styles.activeStatus : styles.hiddenStatus]}>
                {item.is_published && item.is_available ? "In shop" : "Hidden"}
              </Text>
            </View>
            <Text style={styles.bodyText}>{formatMoney(item.price)} · Known costs: {item.purchase_cost !== null && item.other_cost !== null ? formatMoney(Number(item.purchase_cost) + Number(item.other_cost)) : "not fully recorded"}</Text>
            <Text style={styles.helpText}>{item.stock_quantity === null ? "Stock count not tracked" : `${item.stock_quantity} in stock`} · {item.is_available ? "Available" : "Unavailable"}</Text>
            {(item.size_options.length > 0 || item.color_options.length > 0) ? <Text style={styles.helpText}>Sizes: {item.size_options.join(", ") || "Not applicable"} · Colours: {item.color_options.join(", ") || "Not applicable"}</Text> : null}
            <View style={styles.productActions}>
              <Pressable onPress={() => editStoreItem(item)} style={styles.smallButton}><Text style={styles.smallButtonText}>Edit</Text></Pressable>
              <Pressable onPress={() => void toggleStoreItem(item, "is_available")} style={styles.smallButton}><Text style={styles.smallButtonText}>{item.is_available ? "Mark unavailable" : "Mark available"}</Text></Pressable>
              <Pressable onPress={() => void toggleStoreItem(item, "is_published")} style={styles.smallButton}><Text style={styles.smallButtonText}>{item.is_published ? "Hide" : "Publish"}</Text></Pressable>
            </View>
          </View>
        ))}
      </View>
      </> : null}

      {activeSection === "orders" ? <>
      <View style={styles.card}>
        <View style={styles.cardHeadingRow}>
          <View style={styles.cardHeadingIcon}><Text style={styles.cardHeadingIconText}>↗</Text></View>
          <View style={styles.cardHeadingCopy}>
            <Text style={styles.sectionEyebrow}>CUSTOMER REQUESTS & PAYMENTS</Text>
            <Text style={styles.heading}>Orders</Text>
          </View>
          <View style={styles.countPill}><Text style={styles.countPillText}>{orders.length}</Text></View>
        </View>

        <TextInput
          value={orderSearch}
          onChangeText={setOrderSearch}
          placeholder="Search order code, name, or phone"
          placeholderTextColor="#96938D"
          autoCapitalize="none"
          style={styles.searchInput}
        />

        <View style={styles.choiceRow}>
          {([
            ["all", "All orders"],
            ["needs_attention", "Needs attention"],
            ["in_progress", "In progress"],
            ["completed", "Finished"],
          ] as [OrderFilter, string][]).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => setOrderFilter(value)}
              style={[styles.choiceButton, orderFilter === value && styles.choiceButtonSelected]}
            >
              <Text style={[styles.choiceText, orderFilter === value && styles.choiceTextSelected]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}

        {loadingOrders ? (
          <ActivityIndicator color={palette.plum} style={styles.ordersLoading} />
        ) : visibleOrders.length === 0 ? (
          <View style={styles.ordersEmpty}>
            <Text style={styles.ordersEmptyIcon}>✳</Text>
            <Text style={styles.productName}>{orders.length === 0 ? "No orders yet" : "No orders match this view"}</Text>
            <Text style={styles.helpText}>
              {orders.length === 0
                ? "Shop orders and design requests will appear here."
                : "Try another filter or search for a different customer."}
            </Text>
          </View>
        ) : (
          <View style={styles.orderList}>
            {visibleOrders.map((order) => {
              const next = order.order_type === "store_purchase" && order.status === "paid"
                ? ["ready_for_handoff", "alternative_offered", "refund_pending"] as OrderStatus[]
                : nextStatuses[order.status] ?? [];
              const isTransactionOpen = transactionOrderId === order.id;
              const isCostFormOpen = costOrderId === order.id;
              const remainingToPay = Math.max(0, Number(order.total_amount) - Number(order.amount_paid));
              const remainingToRefund = Math.max(0, Number(order.amount_paid) - Number(order.amount_refunded));

              return (
                <View key={order.id} style={styles.orderCard}>
                  <View style={styles.orderTopRow}>
                    <View style={styles.orderCodeBlock}>
                      <Text style={styles.orderCode}>{order.order_code}</Text>
                      <Text style={styles.orderDate}>{new Date(order.created_at).toLocaleDateString()}</Text>
                    </View>
                    <View style={[
                      styles.orderStatusPill,
                      order.status === "completed" || order.status === "delivered" || order.status === "refunded"
                        ? styles.orderStatusDone
                        : order.status === "awaiting_payment" || order.status === "refund_pending" || order.status === "alternative_offered"
                          ? styles.orderStatusAttention
                          : styles.orderStatusActive,
                    ]}>
                      <Text style={[
                        styles.orderStatusText,
                        order.status === "completed" || order.status === "delivered" || order.status === "refunded"
                          ? styles.orderStatusDoneText
                          : order.status === "awaiting_payment" || order.status === "refund_pending" || order.status === "alternative_offered"
                            ? styles.orderStatusAttentionText
                            : styles.orderStatusActiveText,
                      ]}>{statusLabel(order.status)}</Text>
                    </View>
                  </View>

                  <View style={styles.orderCustomerBlock}>
                    <Text style={styles.orderCustomer}>{order.customer_name}</Text>
                    <Text style={styles.helpText}>{order.customer_phone}{order.customer_email ? ` · ${order.customer_email}` : ""}</Text>
                    <Text style={styles.orderType}>{statusLabel(order.order_type)}</Text>
                  </View>

                  {order.items.length > 0 ? (
                    <View style={styles.orderInfoBlock}>
                      <Text style={styles.orderSectionLabel}>ITEMS REQUESTED</Text>
                      {order.items.map((item) => (
                        <View key={item.id} style={styles.orderItemRow}>
                          <View style={styles.orderItemInfo}>
                            <Text style={styles.orderItemName}>{item.quantity} × {item.product_name_snapshot}</Text>
                            <Text style={styles.helpText}>
                              {[item.category_snapshot, item.requested_size, item.requested_color].filter(Boolean).join(" · ") || "Options not specified"}
                            </Text>
                            {Object.keys(item.customization_details ?? {}).length > 0 ? (
                              <Text style={styles.customDetails}>
                                {Object.entries(item.customization_details).map(([key, value]) => `${statusLabel(key)}: ${String(value)}`).join(" · ")}
                              </Text>
                            ) : null}
                          </View>
                          <Text style={styles.orderItemAmount}>
                            {Number(item.quoted_unit_price) > 0
                              ? formatMoney(Number(item.quoted_unit_price) * item.quantity)
                              : "Included in quote"}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {order.customer_request ? (
                    <View style={styles.requestNote}>
                      <Text style={styles.orderSectionLabel}>CUSTOMER NOTES</Text>
                      <Text style={styles.bodyText}>{order.customer_request}</Text>
                    </View>
                  ) : null}

                  <View style={styles.orderInfoBlock}>
                    <Text style={styles.orderSectionLabel}>PAYMENT SUMMARY · {order.payment_status.replace(/_/g, " ").toUpperCase()}</Text>
                    {order.order_type === "store_purchase" && order.status === "awaiting_payment" ? <Text style={styles.helpText}>Stock is held for this order. If the customer will not pay, cancel the order to return counted stock to the Shop.</Text> : null}
                    <View style={styles.moneyLine}><Text style={styles.helpText}>Order total</Text><Text style={styles.moneyValue}>{formatMoney(order.total_amount)}</Text></View>
                    <View style={styles.moneyLine}><Text style={styles.helpText}>Paid</Text><Text style={styles.moneyValue}>{formatMoney(order.amount_paid)}</Text></View>
                    {Number(order.amount_refunded) > 0 ? (
                      <View style={styles.moneyLine}><Text style={styles.helpText}>Refunded</Text><Text style={styles.moneyValue}>{formatMoney(order.amount_refunded)}</Text></View>
                    ) : null}
                    {order.actual_costs_recorded_at ? (
                      <View style={styles.moneyLine}>
                        <Text style={styles.helpText}>Recorded costs</Text>
                        <Text style={styles.moneyValue}>{formatMoney(Number(order.actual_sourcing_cost) + Number(order.actual_printing_cost) + Number(order.actual_delivery_cost) + Number(order.actual_payment_fee) + Number(order.actual_other_cost))}</Text>
                      </View>
                    ) : null}
                    {remainingToPay > 0 ? (
                      <View style={styles.moneyLine}><Text style={styles.helpText}>Balance due</Text><Text style={styles.moneyDue}>{formatMoney(remainingToPay)}</Text></View>
                    ) : null}
                    {order.payments.map((payment) => (
                      <View key={payment.id} style={styles.paymentHistoryRow}>
                        <View style={styles.paymentHistoryCopy}>
                          <Text style={styles.paymentHistoryTitle}>{payment.transaction_type === "refund" ? "Refund" : "Payment"} · {payment.payment_method || payment.provider || "Payment"}</Text>
                          <Text style={styles.helpText}>
                            {payment.confirmed_at ? new Date(payment.confirmed_at).toLocaleDateString() : new Date(payment.created_at).toLocaleDateString()}
                            {payment.provider_reference ? ` · Ref ${payment.provider_reference}` : ""}
                          </Text>
                          {payment.notes ? <Text style={styles.helpText}>{payment.notes}</Text> : null}
                        </View>
                        <Text style={payment.transaction_type === "refund" ? styles.refundValue : styles.paymentValue}>
                          {payment.transaction_type === "refund" ? "−" : "+"}{formatMoney(payment.amount)}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.orderInfoBlock}>
                    <Text style={styles.orderSectionLabel}>FULFILLMENT</Text>
                    <Text style={styles.bodyText}>
                      {order.delivery_method ? statusLabel(order.delivery_method) : "Delivery method not set"}
                      {order.delivery_area ? ` · ${order.delivery_area}` : ""}
                    </Text>
                    {order.delivery_address ? <Text style={styles.helpText}>{order.delivery_address}</Text> : null}
                    {order.delivery_instructions ? <Text style={styles.helpText}>Instructions: {order.delivery_instructions}</Text> : null}
                    {order.rush_days_early > 0 ? (
                      <Text style={styles.rushNote}>Urgent · {order.rush_days_early} day(s) earlier · {formatMoney(order.rush_fee)} fee</Text>
                    ) : null}
                    {order.estimated_delivery_date ? (
                      <Text style={styles.helpText}>Estimated delivery: {new Date(`${order.estimated_delivery_date}T00:00:00`).toLocaleDateString()}</Text>
                    ) : null}
                    {order.customer_artwork_path ? (
                      <Pressable onPress={() => void openCustomerArtwork(order)} style={styles.artworkLink}>
                        <Text style={styles.artworkLinkText}>Open customer artwork ↗</Text>
                      </Pressable>
                    ) : null}
                  </View>

                  {order.admin_notes ? (
                    <View style={styles.requestNote}>
                      <Text style={styles.orderSectionLabel}>PRIVATE ADMIN NOTES</Text>
                      <Text style={styles.bodyText}>{order.admin_notes}</Text>
                    </View>
                  ) : null}

                  <View style={styles.orderActions}>
                    {order.order_type !== "store_purchase" && Number(order.amount_paid) === 0 && ["request_received", "awaiting_payment"].includes(order.status) ? (
                      <Pressable
                        onPress={() => openQuoteForm(order)}
                        style={styles.orderActionButton}
                      >
                        <Text style={styles.orderActionText}>
                          {order.status === "awaiting_payment" ? "Edit quote" : "Prepare quote"}
                        </Text>
                      </Pressable>
                    ) : null}
                    {order.order_type !== "store_purchase" && remainingToPay > 0 && ["request_received", "awaiting_payment"].includes(order.status) ? (
                      <Pressable
                        onPress={() => openTransactionForm(order, "payment")}
                        style={styles.orderActionButton}
                      >
                        <Text style={styles.orderActionText}>Record payment</Text>
                      </Pressable>
                    ) : null}
                    {order.payment_status === "paid" ? (
                      <Pressable onPress={() => isCostFormOpen ? setCostOrderId(null) : openActualCostForm(order)} style={styles.orderActionButton}>
                        <Text style={styles.orderActionText}>{isCostFormOpen ? "Hide actual costs" : order.actual_costs_recorded_at ? "Edit actual costs" : "Record actual costs"}</Text>
                      </Pressable>
                    ) : null}
                    {order.status === "awaiting_payment" && remainingToPay > 0 ? (
                      <Pressable onPress={() => setPaymentLinkOrderId(paymentLinkOrderId === order.id ? null : order.id)} style={styles.orderActionButton}>
                        <Text style={styles.orderActionText}>{paymentLinkOrderId === order.id ? "Hide payment link" : "Show customer payment link"}</Text>
                      </Pressable>
                    ) : null}
                    {order.order_type === "custom_design" && order.status === "awaiting_payment" && remainingToPay > 0 ? (
                      <Pressable onPress={() => contactCustomOrderOnWhatsApp(order)} style={styles.orderActionButton}>
                        <Text style={styles.orderActionText}>Confirm quote on WhatsApp ↗</Text>
                      </Pressable>
                    ) : null}
                    {order.status === "refund_pending" && remainingToRefund > 0 ? (
                      <Pressable
                        onPress={() => openTransactionForm(order, "refund")}
                        style={styles.refundActionButton}
                      >
                        <Text style={styles.refundActionText}>Record refund sent</Text>
                      </Pressable>
                    ) : null}
                    {next.map((status) => (
                      <Pressable
                        key={status}
                        onPress={() => void moveOrder(order, status)}
                        disabled={updatingOrderId === order.id}
                        style={styles.orderActionButton}
                      >
                        <Text style={styles.orderActionText}>
                          {updatingOrderId === order.id ? "Updating…" : status === "refund_pending" ? "Start refund" : status === "alternative_offered" ? "Offer alternative" : status === "awaiting_payment" ? "Set quote ready" : `Move to ${statusLabel(status)}`}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {paymentLinkOrderId === order.id ? (
                    <View style={styles.requestNote}>
                      <Text style={styles.orderSectionLabel}>SEND THIS PAYMENT PAGE TO THE CUSTOMER</Text>
                      <Text selectable style={styles.bodyText}>{`${typeof window !== "undefined" ? window.location.origin : "https://wearwise-gold.vercel.app"}/pay?orderCode=${encodeURIComponent(order.order_code)}`}</Text>
                      <Text style={styles.helpText}>They’ll enter the phone number used for the request and an email for their Paystack receipt.</Text>
                    </View>
                  ) : null}

                  {quoteOrderId === order.id ? (
                    <View style={styles.transactionForm}>
                      <Text style={styles.transactionTitle}>Prepare customer quote</Text>
                      <Text style={styles.helpText}>
                        {order.order_type === "custom_design"
                          ? "Check the requested T-shirt size and colour with your supplier and confirm you can make the design before preparing the quote."
                          : "Confirm the order total before requesting payment. Urgent requests add 20% of the subtotal for each day earlier."}
                      </Text>
                      {order.order_type === "custom_design" ? (
                        <Pressable onPress={() => setAvailabilityConfirmed((value) => !value)} style={styles.activeRow}>
                          <View style={[styles.checkbox, availabilityConfirmed && styles.checkboxChecked]}>
                            {availabilityConfirmed ? <Text style={styles.checkmark}>✓</Text> : null}
                          </View>
                          <Text style={styles.bodyText}>I confirmed the requested size and colour are available and I can make this design.</Text>
                        </Pressable>
                      ) : null}
                      <Field label="Subtotal (GHS)" value={quoteSubtotal} onChangeText={setQuoteSubtotal} keyboardType="decimal-pad" />
                      <Field label="Discount (GHS, optional)" value={quoteDiscount} onChangeText={setQuoteDiscount} keyboardType="decimal-pad" />
                      <Field label="Delivery fee (GHS)" value={quoteDeliveryFee} onChangeText={setQuoteDeliveryFee} keyboardType="decimal-pad" />
                      <Field label="Days earlier than standard delivery" value={quoteRushDays} onChangeText={setQuoteRushDays} keyboardType="number-pad" />
                      <View style={styles.quoteCalculation}>
                        <Text style={styles.helpText}>Urgent fee</Text>
                        <Text style={styles.moneyValue}>
                          {formatMoney(
                            Math.max(0, Number(quoteSubtotal || 0)) *
                              0.2 * Math.max(0, Number(quoteRushDays || 0)),
                          )}
                        </Text>
                      </View>
                      <View style={styles.quoteCalculation}>
                        <Text style={styles.quoteTotalLabel}>Customer total</Text>
                        <Text style={styles.quoteTotalValue}>
                          {formatMoney(
                            Math.max(
                              0,
                              Number(quoteSubtotal || 0) - Number(quoteDiscount || 0) +
                                Number(quoteDeliveryFee || 0) +
                                Number(quoteSubtotal || 0) * 0.2 * Number(quoteRushDays || 0),
                            ),
                          )}
                        </Text>
                      </View>
                      <View style={styles.productActions}>
                        <Pressable onPress={() => void saveQuote(order)} disabled={updatingOrderId === order.id} style={styles.orderActionButton}>
                          <Text style={styles.orderActionText}>{updatingOrderId === order.id ? "Saving…" : order.order_type === "custom_design" ? "Confirm availability and save quote" : "Save quote · request payment"}</Text>
                        </Pressable>
                        <Pressable onPress={() => setQuoteOrderId(null)} style={styles.smallButton}>
                          <Text style={styles.smallButtonText}>Cancel</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}

                  {isTransactionOpen ? (
                    <View style={styles.transactionForm}>
                      <Text style={styles.transactionTitle}>
                        {transactionType === "payment" ? "Record verified payment" : "Record refund sent"}
                      </Text>
                      <Text style={styles.helpText}>
                        Only record a payment or refund after it has been confirmed outside this screen.
                      </Text>
                      <Field
                        label="Amount (GHS)"
                        value={transactionAmount}
                        onChangeText={setTransactionAmount}
                        keyboardType="decimal-pad"
                      />
                      <Field
                        label="Method (Mobile Money, bank, cash…)"
                        value={transactionMethod}
                        onChangeText={setTransactionMethod}
                        placeholder="Mobile Money"
                      />
                      <Field
                        label="Reference (optional)"
                        value={transactionReference}
                        onChangeText={setTransactionReference}
                        placeholder="Transaction reference"
                      />
                      <Field
                        label="Note (optional)"
                        value={transactionNotes}
                        onChangeText={setTransactionNotes}
                        placeholder="Short note for your records"
                      />
                      <View style={styles.productActions}>
                        <Pressable onPress={() => void saveTransaction()} disabled={savingTransaction} style={styles.orderActionButton}>
                          <Text style={styles.orderActionText}>{savingTransaction ? "Saving…" : transactionType === "payment" ? "Save payment" : "Save refund"}</Text>
                        </Pressable>
                        <Pressable onPress={closeTransactionForm} style={styles.smallButton}>
                          <Text style={styles.smallButtonText}>Cancel</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                  {isCostFormOpen ? (
                    <View style={styles.transactionForm}>
                      <Text style={styles.transactionTitle}>Record actual costs</Text>
                      <Text style={styles.helpText}>Use 0 for costs that did not apply. Known profit is calculated only after all five amounts are saved.</Text>
                      <Field label="Sourcing / item cost (GHS)" value={actualSourcingCost} onChangeText={setActualSourcingCost} keyboardType="decimal-pad" />
                      <Field label="Printing cost (GHS)" value={actualPrintingCost} onChangeText={setActualPrintingCost} keyboardType="decimal-pad" />
                      <Field label="Delivery cost (GHS)" value={actualDeliveryCost} onChangeText={setActualDeliveryCost} keyboardType="decimal-pad" />
                      <Field label="Payment fee (GHS)" value={actualPaymentFee} onChangeText={setActualPaymentFee} keyboardType="decimal-pad" />
                      <Field label="Other cost (GHS)" value={actualOtherCost} onChangeText={setActualOtherCost} keyboardType="decimal-pad" />
                      <View style={styles.productActions}>
                        <Pressable onPress={() => void saveActualCosts(order)} disabled={updatingOrderId === order.id} style={styles.orderActionButton}>
                          <Text style={styles.orderActionText}>{updatingOrderId === order.id ? "Saving…" : "Save actual costs"}</Text>
                        </Pressable>
                        <Pressable onPress={() => setCostOrderId(null)} style={styles.smallButton}><Text style={styles.smallButtonText}>Cancel</Text></Pressable>
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </View>
      </> : null}

      {activeSection === "catalog" ? <>
      <View style={styles.card}>
        <View style={styles.cardHeadingRow}>
          <View style={styles.cardHeadingIcon}><Text style={styles.cardHeadingIconText}>{editingId ? "↗" : "+"}</Text></View>
          <View style={styles.cardHeadingCopy}>
            <Text style={styles.sectionEyebrow}>{editingId ? "UPDATE YOUR CATALOG" : "GROW YOUR CATALOG"}</Text>
            <Text style={styles.heading}>
              {editingId ? "Edit product type" : "Add a product type"}
            </Text>
          </View>
          <View style={styles.formStep}><Text style={styles.formStepText}>01</Text></View>
        </View>
        <Text style={styles.helpText}>
          Sizes and colors are common options customers can request. They are
          not live stock counts.
        </Text>

        <Field
          label="Product name"
          value={name}
          onChangeText={setName}
          placeholder="For example: Classic T-shirt"
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.choiceRow}>
          {(["T-shirts", "Jerseys"] as Category[]).map((item) => (
            <Pressable
              key={item}
              onPress={() => setCategory(item)}
              style={[
                styles.choiceButton,
                category === item && styles.choiceButtonSelected,
              ]}
            >
              <Text
                style={[
                  styles.choiceText,
                  category === item && styles.choiceTextSelected,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </View>

        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Fit, material, or other details"
          multiline
        />
        <Field
          label="Customer price (GHS)"
          value={displayPrice}
          onChangeText={setDisplayPrice}
          placeholder="Leave blank if you quote each request"
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>How should the customer price appear?</Text>
        <View style={styles.choiceRow}>
          {(
            [
              ["quote", "Quote first"],
              ["starting_at", "Starting at"],
              ["fixed", "Fixed price"],
            ] as [PriceMode, string][]
          ).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => setPriceMode(value)}
              style={[
                styles.choiceButton,
                priceMode === value && styles.choiceButtonSelected,
              ]}
            >
              <Text
                style={[
                  styles.choiceText,
                  priceMode === value && styles.choiceTextSelected,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Field
          label="Usual sizes"
          value={sizes}
          onChangeText={setSizes}
          placeholder="Example: S, M, L, XL"
        />
        <Field
          label="Usual colors"
          value={colors}
          onChangeText={setColors}
          placeholder="Example: Black, white, navy"
        />

        <View style={styles.privateCostHeader}>
          <Text style={styles.privateHeading}>Your cost notes</Text>
          <View style={styles.privatePill}><Text style={styles.privatePillText}>PRIVATE</Text></View>
        </View>
        <Text style={styles.helpText}>
          These amounts are for your admin view and are not shown to customers.
        </Text>
        <Field
          label="Estimated shirt cost (GHS)"
          value={shirtCost}
          onChangeText={setShirtCost}
          placeholder="Optional"
          keyboardType="decimal-pad"
        />
        <Field
          label="Estimated printing cost (GHS)"
          value={printingCost}
          onChangeText={setPrintingCost}
          placeholder="Optional"
          keyboardType="decimal-pad"
        />

        <Pressable
          onPress={() => setIsActive((current) => !current)}
          style={styles.activeRow}
        >
          <View style={[styles.checkbox, isActive && styles.checkboxChecked]}>
            {isActive ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
          <Text style={styles.bodyText}>Show this product in the catalog</Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}

        <Pressable
          onPress={saveProduct}
          disabled={working}
          style={[styles.primaryButton, working && styles.disabledButton]}
        >
          <Text style={styles.primaryButtonText}>
            {working ? "Saving…" : editingId ? "Save changes" : "Add product"}
          </Text>
        </Pressable>

        {editingId ? (
          <Pressable onPress={clearForm} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancel editing</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeadingRow}>
          <View style={styles.cardHeadingIcon}><Text style={styles.cardHeadingIconText}>▦</Text></View>
          <View style={styles.cardHeadingCopy}>
            <Text style={styles.sectionEyebrow}>WHAT YOU OFFER</Text>
            <Text style={styles.heading}>Your product types</Text>
          </View>
          <View style={styles.countPill}><Text style={styles.countPillText}>{products.length}</Text></View>
        </View>

        {loadingProducts ? (
          <ActivityIndicator color={palette.plum} />
        ) : products.length === 0 ? (
          <Text style={styles.helpText}>
            No product types yet. Add your first one using the form above.
          </Text>
        ) : (
          products.map((product) => (
            <View key={product.id} style={styles.productCard}>
              <View style={styles.productTopRow}>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <View style={styles.categoryPill}><Text style={styles.categoryPillText}>{product.category}</Text></View>
                </View>
                <Text
                  style={[
                    styles.status,
                    product.is_active
                      ? styles.activeStatus
                      : styles.hiddenStatus,
                  ]}
                >
                  {product.is_active ? "Active" : "Hidden"}
                </Text>
              </View>

              <Text style={styles.bodyText}>
                {product.price_mode === "quote"
                  ? "Price confirmed before payment"
                  : `${product.price_mode === "starting_at" ? "From " : ""}${formatMoney(product.display_price)}`}
              </Text>
              <Text style={styles.helpText}>
                Estimated shirt: {formatMoney(product.estimated_shirt_cost)} ·
                printing: {formatMoney(product.estimated_printing_cost)}
              </Text>
              <Text style={styles.helpText}>
                Sizes: {product.usual_sizes.join(", ") || "Not set"}
              </Text>
              <Text style={styles.helpText}>
                Colors: {product.usual_colors.join(", ") || "Not set"}
              </Text>

              <View style={styles.productActions}>
                <Pressable
                  onPress={() => editProduct(product)}
                  style={styles.smallButton}
                >
                  <Text style={styles.smallButtonText}>Edit</Text>
                </Pressable>
                <Pressable
                  onPress={() => void toggleProduct(product)}
                  style={styles.smallButton}
                >
                  <Text style={styles.smallButtonText}>
                    {product.is_active ? "Hide" : "Activate"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>
      </> : null}
      <Text style={styles.dashboardFooter}>WEARWISE · MADE FOR YOUR EVERYDAY</Text>
      </View>
      </View>
      </Animated.View>
    </ScrollView>
  );
}

const palette = {
  paper: "#F5F6F8",
  ink: "#17191D",
  muted: "#737780",
  plum: "#D65B3E",
  violet: "#F4E9E5",
  line: "#E4E6E9",
  white: "#FFFFFF",
  green: "#4D7554",
  softGreen: "#E8F2EB",
  red: "#B74A43",
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.paper },
  pageContent: { width: "100%", maxWidth: 1480, alignSelf: "center", paddingHorizontal: 22, paddingTop: 18, paddingBottom: 42 },
  centeredPage: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 20, backgroundColor: palette.paper },
  loadingText: { color: palette.muted, fontSize: 13 },
  loginPage: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 22, backgroundColor: palette.paper },
  loginCard: { width: "100%", maxWidth: 470, padding: 34, borderRadius: 8, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.line, shadowColor: "#17191D", shadowOpacity: 0.04, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  loginBrandRow: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 30 },
  loginLogo: { width: 47, height: 47, borderRadius: 8, backgroundColor: palette.paper },
  brand: { color: palette.ink, fontSize: 20, fontWeight: "800", letterSpacing: -0.6 },
  brandCaption: { marginTop: 2, color: palette.muted, fontSize: 8, fontWeight: "800", letterSpacing: 1.7 },
  loginAccent: { width: 46, height: 46, alignItems: "center", justifyContent: "center", marginBottom: 19, borderRadius: 8, backgroundColor: palette.violet },
  loginAccentMark: { color: palette.plum, fontSize: 23, fontWeight: "800" },
  loginEyebrow: { color: palette.plum, fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  loginHeading: { marginTop: 7, marginBottom: 5, color: palette.ink, fontSize: 28, fontWeight: "800", letterSpacing: -1 },
  helpText: { color: palette.muted, fontSize: 13, lineHeight: 20 },
  loginForm: { gap: 13, marginTop: 23, marginBottom: 7 },
  field: { marginTop: 4 },
  label: { marginBottom: 7, color: palette.ink, fontSize: 12, fontWeight: "700" },
  input: { minHeight: 48, paddingHorizontal: 13, paddingVertical: 11, borderWidth: 1, borderColor: palette.line, borderRadius: 6, color: palette.ink, backgroundColor: "#FFFFFF", fontSize: 15 },
  multilineInput: { minHeight: 84, textAlignVertical: "top" },
  primaryButton: { minHeight: 49, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 8, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 5, backgroundColor: palette.ink },
  primaryButtonText: { color: palette.white, textAlign: "center", fontSize: 14, fontWeight: "700" },
  primaryButtonArrow: { color: palette.white, fontSize: 17, fontWeight: "700" },
  buttonPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  disabledButton: { opacity: 0.48 },
  secureNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 16 },
  secureNoteIcon: { width: 16, height: 16, overflow: "hidden", borderRadius: 9, color: palette.green, backgroundColor: palette.softGreen, fontSize: 11, fontWeight: "800", textAlign: "center" },
  secureNoteText: { color: palette.muted, fontSize: 10 },
  loginFooter: { marginTop: 23, color: "#96938D", fontSize: 9, fontWeight: "700", textAlign: "center", letterSpacing: 1.4 },
  error: { marginTop: 9, color: palette.red, fontSize: 13, lineHeight: 19 },
  success: { color: palette.green, fontSize: 13, fontWeight: "600" },
  dashboard: { width: "100%" },
  dashboardWide: { minHeight: "100%" },
  adminShell: { width: "100%", gap: 18 },
  adminShellWide: { flexDirection: "row", alignItems: "stretch", gap: 24 },
  adminSidebar: { width: "100%", flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, padding: 12, borderWidth: 1, borderColor: palette.line, borderRadius: 8, backgroundColor: palette.white },
  adminSidebarWide: { width: 224, flexDirection: "column", flexWrap: "nowrap", alignItems: "stretch", alignSelf: "stretch", padding: 16 },
  adminSidebarCompact: { justifyContent: "space-between" },
  sidebarLabel: { width: "100%", marginTop: 12, marginBottom: 3, color: palette.muted, fontSize: 8, fontWeight: "900", letterSpacing: 1.3 },
  sidebarLink: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 5 },
  sidebarLinkActive: { backgroundColor: palette.violet },
  sidebarIcon: { width: 18, color: palette.muted, fontSize: 15, textAlign: "center" },
  sidebarIconActive: { color: palette.plum },
  sidebarLinkText: { color: "#53565D", fontSize: 11, fontWeight: "600" },
  sidebarLinkTextActive: { color: palette.plum, fontWeight: "800" },
  sidebarSpacer: { flex: 1 },
  adminMain: { flex: 1, minWidth: 0, gap: 16 },
  header: { minHeight: 58, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: palette.line },
  headerKicker: { color: palette.muted, fontSize: 8, fontWeight: "900", letterSpacing: 1.4 },
  headerTitle: { marginTop: 3, color: palette.ink, fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  headerAccount: { maxWidth: "48%", color: palette.muted, fontSize: 10 },
  dashboardBrand: { flexDirection: "row", alignItems: "center", gap: 10 },
  dashboardLogo: { width: 42, height: 42, borderRadius: 12, backgroundColor: palette.white },
  signOutButton: { paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: palette.line, borderRadius: 5, backgroundColor: palette.white },
  signOutButtonText: { color: palette.ink, fontSize: 11, fontWeight: "700" },
  dashboardIntro: { minHeight: 140, flexDirection: "row", alignItems: "center", justifyContent: "space-between", overflow: "hidden", padding: 28, borderRadius: 8, backgroundColor: "#202125" },
  dashboardIntroCopy: { flex: 1, gap: 6 },
  dashboardTitle: { color: palette.white, fontSize: 29, fontWeight: "800", letterSpacing: -1 },
  dashboardSubtitle: { color: "#C5C5C8", fontSize: 12 },
  dashboardSparkle: { width: 76, height: 76, alignItems: "center", justifyContent: "center", marginLeft: 14, borderRadius: 8, backgroundColor: palette.plum },
  dashboardSparkleText: { color: palette.white, fontSize: 33, fontWeight: "900" },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: { flexGrow: 1, flexBasis: "22%", minWidth: 150, padding: 18, borderWidth: 1, borderColor: palette.line, borderRadius: 7, backgroundColor: palette.white, gap: 6 },
  metricLabel: { color: palette.muted, fontSize: 10, fontWeight: "700" },
  metricValue: { color: palette.ink, fontSize: 19, fontWeight: "900" },
  metricNote: { color: palette.muted, fontSize: 9 },
  card: { width: "100%", padding: 22, borderRadius: 7, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.white, gap: 10 },
  cardHeadingRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  cardHeadingIcon: { width: 39, height: 39, alignItems: "center", justifyContent: "center", borderRadius: 7, backgroundColor: palette.violet },
  cardHeadingIconText: { color: palette.plum, fontSize: 22, fontWeight: "700" },
  cardHeadingCopy: { flex: 1 },
  sectionEyebrow: { marginBottom: 3, color: palette.plum, fontSize: 8, fontWeight: "800", letterSpacing: 1.2 },
  formStep: { width: 29, height: 29, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: palette.paper },
  formStepText: { color: palette.muted, fontSize: 10, fontWeight: "800" },
  heading: { marginTop: 4, marginBottom: 5, color: palette.ink, fontSize: 21, fontWeight: "800", letterSpacing: -0.5 },
  bodyText: { color: palette.ink, fontSize: 14, lineHeight: 21 },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  choiceButton: { paddingVertical: 9, paddingHorizontal: 13, borderWidth: 1, borderColor: palette.line, borderRadius: 5, backgroundColor: palette.white },
  choiceButtonSelected: { borderColor: palette.plum, backgroundColor: palette.plum },
  choiceText: { color: palette.ink, fontSize: 12, fontWeight: "600" },
  choiceTextSelected: { color: palette.white, fontWeight: "700" },
  privateCostHeader: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 10 },
  storeInventoryHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, paddingTop: 15, borderTopWidth: 1, borderTopColor: palette.line },
  storePhotoRow: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 5 },
  storePhotoTile: { width: 82, height: 82, position: "relative", overflow: "hidden", borderRadius: 12, backgroundColor: "#F0EDE6" },
  storePhoto: { width: "100%", height: "100%" },
  storePhotoRemove: { position: "absolute", top: 4, right: 4, width: 23, height: 23, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "rgba(37,38,43,0.82)" },
  storePhotoRemoveText: { color: palette.white, fontSize: 19, lineHeight: 20, fontWeight: "700" },
  storeListImage: { width: 56, height: 64, borderRadius: 9, backgroundColor: "#F0EDE6" },
  privateHeading: { color: palette.ink, fontSize: 15, fontWeight: "800" },
  privatePill: { paddingVertical: 4, paddingHorizontal: 7, borderRadius: 9, backgroundColor: palette.softGreen },
  privatePillText: { color: palette.green, fontSize: 8, fontWeight: "900", letterSpacing: 0.7 },
  activeRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  checkbox: { width: 22, height: 22, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#C9C5BB", borderRadius: 7 },
  checkboxChecked: { borderColor: palette.plum, backgroundColor: palette.plum },
  checkmark: { color: palette.white, fontWeight: "800" },
  cancelButton: { padding: 12, alignItems: "center" },
  cancelButtonText: { color: palette.muted, fontSize: 13, fontWeight: "600" },
  productCard: { marginTop: 4, padding: 16, borderWidth: 1, borderColor: palette.line, borderRadius: 6, backgroundColor: "#FFFFFF", gap: 8 },
  productTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  productInfo: { flex: 1, gap: 5 },
  productName: { color: palette.ink, fontSize: 16, fontWeight: "800" },
  categoryPill: { alignSelf: "flex-start", paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4, backgroundColor: palette.violet },
  categoryPillText: { color: palette.plum, fontSize: 9, fontWeight: "800" },
  status: { paddingVertical: 5, paddingHorizontal: 8, overflow: "hidden", borderRadius: 11, fontSize: 10, fontWeight: "800" },
  activeStatus: { color: palette.green, backgroundColor: palette.softGreen },
  hiddenStatus: { color: palette.muted, backgroundColor: "#EFEEEA" },
  productActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  smallButton: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 4, backgroundColor: palette.violet },
  smallButtonText: { color: palette.plum, fontSize: 12, fontWeight: "700" },
  countPill: { minWidth: 28, height: 28, alignItems: "center", justifyContent: "center", paddingHorizontal: 7, borderRadius: 14, backgroundColor: palette.paper },
  countPillText: { color: palette.ink, fontSize: 11, fontWeight: "800" },
  searchInput: { minHeight: 45, paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: palette.line, borderRadius: 11, color: palette.ink, backgroundColor: "#FDFCF9", fontSize: 14 },
  ordersLoading: { marginVertical: 26 },
  ordersEmpty: { alignItems: "center", paddingHorizontal: 18, paddingVertical: 28, borderRadius: 15, backgroundColor: "#F7F4EE", gap: 6 },
  ordersEmptyIcon: { marginBottom: 3, color: palette.plum, fontSize: 27 },
  orderList: { gap: 13, marginTop: 2 },
  orderCard: { padding: 16, borderWidth: 1, borderColor: palette.line, borderRadius: 6, backgroundColor: "#FFFFFF", gap: 13 },
  orderTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  orderCodeBlock: { gap: 4 },
  orderCode: { color: palette.ink, fontSize: 15, fontWeight: "900", letterSpacing: 0.3 },
  orderDate: { color: palette.muted, fontSize: 10 },
  orderStatusPill: { maxWidth: "58%", paddingVertical: 5, paddingHorizontal: 8, borderRadius: 11 },
  orderStatusText: { fontSize: 9, fontWeight: "800" },
  orderStatusActive: { backgroundColor: palette.violet },
  orderStatusActiveText: { color: palette.plum },
  orderStatusAttention: { backgroundColor: "#FBE9DE" },
  orderStatusAttentionText: { color: "#A45235" },
  orderStatusDone: { backgroundColor: palette.softGreen },
  orderStatusDoneText: { color: palette.green },
  orderCustomerBlock: { gap: 4 },
  orderCustomer: { color: palette.ink, fontSize: 15, fontWeight: "800" },
  orderType: { alignSelf: "flex-start", marginTop: 3, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 9, color: palette.plum, backgroundColor: palette.violet, fontSize: 9, fontWeight: "800" },
  orderInfoBlock: { gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: palette.line },
  orderSectionLabel: { marginBottom: 1, color: palette.muted, fontSize: 8, fontWeight: "900", letterSpacing: 1.1 },
  orderItemRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, paddingVertical: 3 },
  orderItemInfo: { flex: 1, gap: 3 },
  orderItemName: { color: palette.ink, fontSize: 12, fontWeight: "700" },
  orderItemAmount: { color: palette.ink, fontSize: 11, fontWeight: "700" },
  customDetails: { color: palette.plum, fontSize: 11, lineHeight: 16 },
  requestNote: { gap: 6, padding: 11, borderRadius: 11, backgroundColor: palette.violet },
  moneyLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  moneyValue: { color: palette.ink, fontSize: 12, fontWeight: "700" },
  moneyDue: { color: "#A45235", fontSize: 12, fontWeight: "800" },
  paymentHistoryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 5, paddingTop: 8, borderTopWidth: 1, borderTopColor: palette.line },
  paymentHistoryCopy: { flex: 1, gap: 3 },
  paymentHistoryTitle: { color: palette.ink, fontSize: 11, fontWeight: "700" },
  paymentValue: { color: palette.green, fontSize: 12, fontWeight: "800" },
  refundValue: { color: palette.red, fontSize: 12, fontWeight: "800" },
  rushNote: { color: "#A45235", fontSize: 11, fontWeight: "700" },
  artworkLink: { alignSelf: "flex-start", marginTop: 3 },
  artworkLinkText: { color: palette.plum, fontSize: 11, fontWeight: "800" },
  orderActions: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  orderActionButton: { minHeight: 36, justifyContent: "center", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: palette.plum },
  orderActionText: { color: palette.white, fontSize: 10, fontWeight: "700" },
  refundActionButton: { minHeight: 36, justifyContent: "center", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: "#FBE9DE" },
  refundActionText: { color: "#A45235", fontSize: 10, fontWeight: "800" },
  transactionForm: { padding: 13, borderWidth: 1, borderColor: palette.line, borderRadius: 13, backgroundColor: palette.white, gap: 6 },
  transactionTitle: { color: palette.ink, fontSize: 14, fontWeight: "800" },
  quoteCalculation: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 7, borderTopWidth: 1, borderTopColor: palette.line },
  quoteTotalLabel: { color: palette.ink, fontSize: 13, fontWeight: "800" },
  quoteTotalValue: { color: palette.plum, fontSize: 15, fontWeight: "900" },
  dashboardFooter: { paddingTop: 3, color: "#96938D", fontSize: 9, fontWeight: "700", textAlign: "center", letterSpacing: 1.4 },
});
