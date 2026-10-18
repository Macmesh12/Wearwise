import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { publicSupabaseAnonKey, publicSupabaseUrl, supabase } from "../lib/supabase";

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
  stock_quantity: number | null;
};

type DeliverySettings = {
  campus_handoff_fee: number | string;
  sister_office_handoff_fee: number | string;
  courier_fee: number | string | null;
  other_fee: number | string | null;
  free_delivery_areas: string[];
};

type DeliveryMethod = "campus_handoff" | "sister_office_handoff" | "courier" | "other";

const palette = { paper: "#F7F7F5", ink: "#17191D", muted: "#737780", plum: "#D65B3E", violet: "#F2EDE8", line: "#E4E6E9", white: "#FFFFFF", red: "#B74A43", green: "#4D7554", softGreen: "#E8F2EB" };

export default function ShopCheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ itemId?: string }>();
  const itemId = typeof params.itemId === "string" ? params.itemId : "";
  const [item, setItem] = useState<StoreItem | null>(null);
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [orderCode, setOrderCode] = useState("");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("campus_handoff");
  const [deliveryArea, setDeliveryArea] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryInstructions, setDeliveryInstructions] = useState("");

  useEffect(() => {
    let active = true;
    async function loadCheckout() {
      const [itemResult, settingsResult] = await Promise.all([
        supabase.from("store_items")
          .select("id, name, category, description, price, currency_code, image_paths, size_options, color_options, stock_quantity")
          .eq("id", itemId).eq("is_published", true).eq("is_available", true).maybeSingle(),
        supabase.from("store_delivery_settings")
          .select("campus_handoff_fee, sister_office_handoff_fee, courier_fee, other_fee, free_delivery_areas")
          .eq("singleton", true).maybeSingle(),
      ]);
      if (!active) return;
      if (itemResult.error || !itemResult.data) {
        setError(itemResult.error?.message ?? "This item is no longer available.");
      } else {
        const loadedItem = itemResult.data as StoreItem;
        setItem(loadedItem);
        setSize(loadedItem.size_options[0] ?? "");
        setColor(loadedItem.color_options[0] ?? "");
      }
      if (settingsResult.error || !settingsResult.data) {
        setError(settingsResult.error?.message ?? "Shop delivery prices are not set up yet.");
      } else {
        setDeliverySettings(settingsResult.data as DeliverySettings);
      }
      setLoading(false);
    }
    if (!itemId) {
      setError("Choose an item from the Shop first.");
      setLoading(false);
    } else void loadCheckout();
    return () => { active = false; };
  }, [itemId]);

  const deliveryFee = useMemo(() => {
    if (!deliverySettings) return null;
    const isFreeArea = deliveryArea.trim() && deliverySettings.free_delivery_areas.some(
      (area) => area.trim().toLowerCase() === deliveryArea.trim().toLowerCase(),
    );
    if (isFreeArea) return 0;
    const fee = {
      campus_handoff: deliverySettings.campus_handoff_fee,
      sister_office_handoff: deliverySettings.sister_office_handoff_fee,
      courier: deliverySettings.courier_fee,
      other: deliverySettings.other_fee,
    }[deliveryMethod];
    return fee === null ? null : Number(fee);
  }, [deliveryArea, deliveryMethod, deliverySettings]);

  const total = item && deliveryFee !== null ? Number(item.price) * quantity + deliveryFee : null;

  async function placeOrder() {
    setError("");
    if (!item) return;
    if (item.stock_quantity !== null && item.stock_quantity < quantity) {
      setError("There is not enough stock for that quantity. Change the quantity and try again.");
      return;
    }
    if (item.size_options.length > 0 && !size) { setError("Choose a size."); return; }
    if (item.color_options.length > 0 && !color) { setError("Choose a colour."); return; }
    if (!customerName.trim() || customerPhone.replace(/\D/g, "").length < 7) {
      setError("Enter your name and a valid phone number.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
      setError("Enter a valid email address for your payment receipt.");
      return;
    }
    if (deliveryFee === null) {
      setError("This delivery method is not ready yet. Choose another method or contact WearWise.");
      return;
    }
    if ((deliveryMethod === "courier" || deliveryMethod === "other") && !deliveryAddress.trim()) {
      setError("Enter the delivery address.");
      return;
    }

    setWorking(true);
    try {
      const orderResponse = await fetch(`${publicSupabaseUrl}/functions/v1/create-store-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: publicSupabaseAnonKey, Authorization: `Bearer ${publicSupabaseAnonKey}` },
        body: JSON.stringify({
          itemId: item.id, quantity, size, color,
          customer: { name: customerName, phone: customerPhone, email: customerEmail },
          delivery: { method: deliveryMethod, area: deliveryArea, address: deliveryAddress, instructions: deliveryInstructions },
        }),
      });
      const order = await orderResponse.json();
      if (!orderResponse.ok || !order.order_code) throw new Error(order.error ?? "We couldn’t save your order.");
      setOrderCode(order.order_code);

      const paymentResponse = await fetch(`${publicSupabaseUrl}/functions/v1/initialize-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: publicSupabaseAnonKey, Authorization: `Bearer ${publicSupabaseAnonKey}` },
        body: JSON.stringify({ orderCode: order.order_code, phone: customerPhone, email: customerEmail }),
      });
      const payment = await paymentResponse.json();
      if (!paymentResponse.ok || !payment.authorizationUrl) {
        throw new Error(`${payment.error ?? "Payment could not start."} Your order code is ${order.order_code}.`);
      }
      await Linking.openURL(payment.authorizationUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout failed. Please try again.");
    }
    setWorking(false);
  }

  if (loading) return <View style={styles.center}><Stack.Screen options={{ headerShown: false }} /><ActivityIndicator color={palette.plum} /><Text style={styles.loadingText}>Preparing checkout…</Text></View>;

  return <View style={styles.page}>
    <Stack.Screen options={{ headerShown: false }} />
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>← Back to Shop</Text></Pressable>
          <View style={styles.brandRow}><Image source={require("../assets/images/logo.png")} style={styles.logo} resizeMode="contain" /><Text style={styles.brand}>WearWise</Text></View>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>READY TO ORDER</Text>
            <Text style={styles.title}>Your shop order</Text>
            {item ? <View style={styles.itemSummary}>
              {item.image_paths[0] ? <Image source={{ uri: supabase.storage.from("store-items").getPublicUrl(item.image_paths[0]).data.publicUrl }} style={styles.itemImage} resizeMode="cover" /> : null}
              <View style={styles.itemCopy}><Text style={styles.itemCategory}>{item.category}</Text><Text style={styles.itemName}>{item.name}</Text><Text style={styles.itemPrice}>{item.currency_code} {Number(item.price).toFixed(2)}</Text>{item.description ? <Text style={styles.help}>{item.description}</Text> : null}</View>
            </View> : null}

            {item?.size_options.length ? <ChoiceGroup label="Size" options={item.size_options} selected={size} onSelect={setSize} /> : null}
            {item?.color_options.length ? <ChoiceGroup label="Colour" options={item.color_options} selected={color} onSelect={setColor} /> : null}
            {item?.stock_quantity !== null && item?.stock_quantity !== undefined ? <Text style={styles.stockNote}>{item.stock_quantity} in stock</Text> : null}
            <View style={styles.quantityRow}><Text style={styles.label}>Quantity</Text><View style={styles.quantityControls}><Pressable onPress={() => setQuantity((value) => Math.max(1, value - 1))} style={styles.quantityButton}><Text style={styles.quantityButtonText}>−</Text></Pressable><Text style={styles.quantityValue}>{quantity}</Text><Pressable onPress={() => setQuantity((value) => Math.min(20, item?.stock_quantity ?? 20, value + 1))} style={styles.quantityButton}><Text style={styles.quantityButtonText}>+</Text></Pressable></View></View>

            <Text style={styles.formHeading}>Your details</Text>
            <Field label="Full name" value={customerName} onChangeText={setCustomerName} placeholder="Your name" />
            <Field label="Phone number" value={customerPhone} onChangeText={setCustomerPhone} placeholder="For order updates" keyboardType="phone-pad" />
            <Field label="Email for payment receipt" value={customerEmail} onChangeText={setCustomerEmail} placeholder="you@example.com" keyboardType="email-address" />

            <Text style={styles.formHeading}>Delivery</Text>
            <View style={styles.methodList}>
              {([
                ["campus_handoff", "Campus handoff", deliverySettings?.campus_handoff_fee],
                ["sister_office_handoff", "Sister’s office handoff", deliverySettings?.sister_office_handoff_fee],
                ["courier", "Courier", deliverySettings?.courier_fee],
                ["other", "Other delivery", deliverySettings?.other_fee],
              ] as [DeliveryMethod, string, number | string | null | undefined][]).map(([value, label, fee]) => {
                const selected = deliveryMethod === value;
                const areaFree = Boolean(deliveryArea.trim() && deliverySettings?.free_delivery_areas.some(
                  (area) => area.trim().toLowerCase() === deliveryArea.trim().toLowerCase(),
                ));
                const disabled = (fee === null || fee === undefined) && !areaFree;
                const displayFee = areaFree ? 0 : fee;
                return <Pressable key={value} disabled={disabled} onPress={() => setDeliveryMethod(value)} style={[styles.methodOption, selected && styles.methodOptionSelected, disabled && styles.methodOptionDisabled]}>
                  <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
                  <Text style={[styles.methodLabel, disabled && styles.disabledText]}>{label}{disabled ? " · unavailable" : ""}</Text>
                  <Text style={styles.methodFee}>{disabled ? "—" : `GHS ${Number(displayFee).toFixed(2)}`}</Text>
                </Pressable>;
              })}
            </View>
            <Field label="Delivery area" value={deliveryArea} onChangeText={setDeliveryArea} placeholder="Area or campus" />
            {deliveryArea.trim() && deliverySettings?.free_delivery_areas.some((area) => area.toLowerCase() === deliveryArea.trim().toLowerCase()) ? <Text style={styles.freeAreaNote}>Delivery is free in this area.</Text> : null}
            {deliveryMethod === "courier" || deliveryMethod === "other" ? <Field label="Delivery address" value={deliveryAddress} onChangeText={setDeliveryAddress} placeholder="House, street, landmark" multiline /> : null}
            <Field label="Delivery instructions (optional)" value={deliveryInstructions} onChangeText={setDeliveryInstructions} placeholder="Anything the delivery person should know" multiline />

            <View style={styles.totalBox}>
              <View style={styles.totalLine}><Text style={styles.totalLabel}>Items</Text><Text style={styles.totalValue}>{item?.currency_code} {item ? (Number(item.price) * quantity).toFixed(2) : "0.00"}</Text></View>
              <View style={styles.totalLine}><Text style={styles.totalLabel}>Delivery</Text><Text style={styles.totalValue}>{deliveryFee === null ? "Choose an available method" : `GHS ${deliveryFee.toFixed(2)}`}</Text></View>
              <View style={[styles.totalLine, styles.grandTotal]}><Text style={styles.grandTotalLabel}>Total to pay</Text><Text style={styles.grandTotalValue}>{total === null ? "—" : `GHS ${total.toFixed(2)}`}</Text></View>
            </View>
            <Text style={styles.paymentNote}>Your order is confirmed after Paystack confirms payment. Shop orders are usually prepared for delivery the next day or within two days.</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {orderCode ? <Text style={styles.orderCode}>Order code: {orderCode}</Text> : null}
            {orderCode && error ? <Pressable onPress={() => router.push({ pathname: "/pay", params: { orderCode, phone: customerPhone, email: customerEmail } })} style={styles.retryButton}><Text style={styles.retryButtonText}>Open payment page</Text></Pressable> : null}
            <Pressable onPress={() => void placeOrder()} disabled={working || !item || item.stock_quantity === 0} style={[styles.button, (working || !item || item.stock_quantity === 0) && styles.disabledButton]}>
              {working ? <ActivityIndicator color={palette.white} /> : <Text style={styles.buttonText}>{item?.stock_quantity === 0 ? "Sold out" : "Place order and pay ↗"}</Text>}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}

function ChoiceGroup({ label, options, selected, onSelect }: { label: string; options: string[]; selected: string; onSelect: (value: string) => void }) {
  return <View style={styles.choiceGroup}><Text style={styles.label}>{label}</Text><View style={styles.choices}>{options.map((option) => <Pressable key={option} onPress={() => onSelect(option)} style={[styles.choice, selected === option && styles.choiceSelected]}><Text style={[styles.choiceText, selected === option && styles.choiceTextSelected]}>{option}</Text></Pressable>)}</View></View>;
}

function Field({ label, value, onChangeText, placeholder, multiline, keyboardType }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean; keyboardType?: "default" | "phone-pad" | "email-address" }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#99969A" keyboardType={keyboardType} multiline={multiline} style={[styles.input, multiline && styles.multiline]} /></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.paper }, flex: { flex: 1 }, scroll: { flexGrow: 1, alignItems: "center", padding: 18 }, content: { width: "100%", maxWidth: 760 }, center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: palette.paper }, loadingText: { color: palette.muted, fontSize: 13 }, back: { paddingVertical: 10, alignSelf: "flex-start" }, backText: { color: palette.muted, fontSize: 13 }, brandRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 7, marginBottom: 20 }, logo: { width: 36, height: 36 }, brand: { color: palette.ink, fontSize: 20, fontWeight: "800" }, card: { padding: 24, borderWidth: 1, borderColor: palette.line, borderRadius: 8, backgroundColor: palette.white }, eyebrow: { color: palette.plum, fontSize: 10, fontWeight: "900", letterSpacing: 1.4 }, title: { marginTop: 8, color: palette.ink, fontSize: 28, fontWeight: "800", letterSpacing: -0.8 }, itemSummary: { flexDirection: "row", gap: 14, marginTop: 18, padding: 12, borderRadius: 5, backgroundColor: "#F2F1EF" }, itemImage: { width: 92, height: 105, borderRadius: 4, backgroundColor: "#E8E7E5" }, itemCopy: { flex: 1, justifyContent: "center", gap: 4 }, itemCategory: { color: palette.plum, fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 }, itemName: { color: palette.ink, fontSize: 17, fontWeight: "800" }, itemPrice: { color: palette.ink, fontSize: 13, fontWeight: "800" }, help: { color: palette.muted, fontSize: 11, lineHeight: 16 }, choiceGroup: { marginTop: 17 }, label: { marginBottom: 7, color: palette.ink, fontSize: 12, fontWeight: "700" }, choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, choice: { paddingHorizontal: 13, paddingVertical: 9, borderWidth: 1, borderColor: palette.line, borderRadius: 5, backgroundColor: palette.white }, choiceSelected: { borderColor: palette.plum, backgroundColor: palette.plum }, choiceText: { color: palette.ink, fontSize: 11, fontWeight: "700" }, choiceTextSelected: { color: palette.white }, stockNote: { marginTop: 12, color: palette.muted, fontSize: 11 }, quantityRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.line }, quantityControls: { flexDirection: "row", alignItems: "center", gap: 15 }, quantityButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 4, backgroundColor: palette.violet }, quantityButtonText: { color: palette.plum, fontSize: 20, fontWeight: "700" }, quantityValue: { minWidth: 18, color: palette.ink, fontSize: 14, fontWeight: "800", textAlign: "center" }, formHeading: { marginTop: 22, marginBottom: 2, color: palette.ink, fontSize: 16, fontWeight: "800" }, field: { marginTop: 13 }, input: { minHeight: 47, paddingHorizontal: 13, paddingVertical: 11, borderWidth: 1, borderColor: palette.line, borderRadius: 5, color: palette.ink, backgroundColor: "#FFFFFF", fontSize: 14 }, multiline: { minHeight: 76, textAlignVertical: "top" }, methodList: { gap: 8, marginTop: 8 }, methodOption: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: palette.line, borderRadius: 5, backgroundColor: palette.white }, methodOptionSelected: { borderColor: palette.plum, backgroundColor: "#FAF3F0" }, methodOptionDisabled: { opacity: 0.45 }, radio: { width: 18, height: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#BDB9C6", borderRadius: 9 }, radioSelected: { borderColor: palette.plum }, radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: palette.plum }, methodLabel: { flex: 1, color: palette.ink, fontSize: 12, fontWeight: "700" }, methodFee: { color: palette.ink, fontSize: 11, fontWeight: "800" }, disabledText: { color: palette.muted }, freeAreaNote: { marginTop: 7, color: palette.green, fontSize: 11, fontWeight: "700" }, totalBox: { gap: 10, marginTop: 21, padding: 15, borderRadius: 6, backgroundColor: "#F2F1EF" }, totalLine: { flexDirection: "row", justifyContent: "space-between", gap: 12 }, totalLabel: { color: palette.muted, fontSize: 12 }, totalValue: { color: palette.ink, fontSize: 12, fontWeight: "700" }, grandTotal: { marginTop: 3, paddingTop: 11, borderTopWidth: 1, borderTopColor: palette.line }, grandTotalLabel: { color: palette.ink, fontSize: 14, fontWeight: "800" }, grandTotalValue: { color: palette.plum, fontSize: 16, fontWeight: "900" }, paymentNote: { marginTop: 14, color: palette.muted, fontSize: 11, lineHeight: 17 }, error: { marginTop: 13, color: palette.red, fontSize: 12, lineHeight: 18 }, orderCode: { marginTop: 11, color: palette.plum, fontSize: 12, fontWeight: "800" }, button: { minHeight: 50, alignItems: "center", justifyContent: "center", marginTop: 18, padding: 14, borderRadius: 5, backgroundColor: palette.ink }, buttonText: { color: palette.white, fontSize: 14, fontWeight: "800" }, retryButton: { marginTop: 11, alignSelf: "flex-start" }, retryButtonText: { color: palette.plum, fontSize: 12, fontWeight: "800" }, disabledButton: { opacity: 0.45 },
});
