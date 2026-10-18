import { useEffect, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { publicSupabaseAnonKey, publicSupabaseUrl } from "../lib/supabase";

const colors = { paper: "#F7F7F5", ink: "#17191D", muted: "#737780", plum: "#D65B3E", violet: "#F2EDE8", line: "#E4E6E9", white: "#FFFFFF", red: "#B74A43", green: "#4D7554" };

export default function PayScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderCode?: string; phone?: string; email?: string }>();
  const [orderCode, setOrderCode] = useState(typeof params.orderCode === "string" ? params.orderCode : "");
  const [phone, setPhone] = useState(typeof params.phone === "string" ? params.phone : "");
  const [email, setEmail] = useState(typeof params.email === "string" ? params.email : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof params.orderCode === "string") setOrderCode(params.orderCode);
    if (typeof params.phone === "string") setPhone(params.phone);
    if (typeof params.email === "string") setEmail(params.email);
  }, [params.orderCode, params.phone, params.email]);

  async function startPayment() {
    setError("");
    if (!orderCode.trim() || !phone.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter your order code, phone number, and a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${publicSupabaseUrl}/functions/v1/initialize-payment`, {
        method: "POST", headers: { "Content-Type": "application/json", apikey: publicSupabaseAnonKey, Authorization: `Bearer ${publicSupabaseAnonKey}` },
        body: JSON.stringify({ orderCode, phone, email }),
      });
      const data = await response.json();
      if (!response.ok || !data.authorizationUrl) throw new Error(data.error || "Checkout could not be started.");
      await Linking.openURL(data.authorizationUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not connect to WearWise. Please try again.");
    }
    setBusy(false);
  }

  return <View style={styles.page}>
    <Stack.Screen options={{ headerShown: false }} />
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>← Back</Text></Pressable>
          <View style={styles.brandRow}><Image source={require("../assets/images/logo.png")} style={styles.logo} resizeMode="contain"/><Text style={styles.brand}>WearWise</Text></View>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>SECURE CHECKOUT</Text>
            <Text style={styles.title}>Pay for your order</Text>
            <Text style={styles.body}>Enter the details WearWise gave you. We’ll look up your confirmed quote and take you to Paystack to complete payment.</Text>
            <Field label="Order code" value={orderCode} onChangeText={setOrderCode} placeholder="WW-1234ABCD" autoCapitalize="characters" />
            <Field label="Phone number used for the request" value={phone} onChangeText={setPhone} placeholder="Your phone number" keyboardType="phone-pad" />
            <Field label="Email for payment receipt" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
            <Text style={styles.note}>Paystack confirms your payment directly. WearWise updates the order and prepares the item or begins approved design work after payment.</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable onPress={() => void startPayment()} disabled={busy} style={[styles.button, busy && styles.disabled]}>
              {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Continue to secure payment ↗</Text>}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}

function Field({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: "default" | "phone-pad" | "email-address"; autoCapitalize?: "none" | "characters" }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#99969A" keyboardType={keyboardType} autoCapitalize={autoCapitalize ?? "none"} style={styles.input} /></View>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.paper }, flex: { flex: 1 }, scroll: { flexGrow: 1, alignItems: "center", padding: 20 }, content: { width: "100%", maxWidth: 560 }, back: { paddingVertical: 12, alignSelf: "flex-start" }, backText: { color: colors.muted, fontSize: 14 }, brandRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, marginBottom: 26 }, logo: { width: 34, height: 34 }, brand: { color: colors.plum, fontSize: 20, fontWeight: "800" }, card: { backgroundColor: colors.white, borderRadius: 24, padding: 26, borderWidth: 1, borderColor: colors.line }, eyebrow: { color: colors.plum, fontWeight: "800", fontSize: 11, letterSpacing: 1.5 }, title: { color: colors.ink, fontSize: 30, fontWeight: "800", marginTop: 10 }, body: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 10, marginBottom: 14 }, field: { marginTop: 14 }, label: { color: colors.ink, fontWeight: "700", fontSize: 13, marginBottom: 7 }, input: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, color: colors.ink, fontSize: 15, outlineStyle: "none" as never }, note: { marginTop: 18, color: colors.muted, fontSize: 12, lineHeight: 18 }, error: { color: colors.red, fontSize: 13, marginTop: 14, lineHeight: 19 }, button: { backgroundColor: colors.plum, marginTop: 20, borderRadius: 14, padding: 16, alignItems: "center" }, buttonText: { color: colors.white, fontWeight: "800", fontSize: 15 }, disabled: { opacity: 0.65 } });
