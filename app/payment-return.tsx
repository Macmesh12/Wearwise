import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { publicSupabaseAnonKey, publicSupabaseUrl } from "../lib/supabase";

type State = "checking" | "paid" | "pending" | "failed" | "error";
export default function PaymentReturnScreen() {
  const params = useLocalSearchParams<{ reference?: string; trxref?: string; orderCode?: string }>();
  const router = useRouter();
  const reference = typeof params.reference === "string" ? params.reference : typeof params.trxref === "string" ? params.trxref : "";
  const orderCode = typeof params.orderCode === "string" ? params.orderCode : "";
  const [state, setState] = useState<State>("checking");
  const [message, setMessage] = useState("Checking your payment securely with Paystack…");

  useEffect(() => {
    let active = true;
    async function verify() {
      if (!reference) { setState("error"); setMessage("We couldn’t find a payment reference. If you completed payment, contact WearWise with your order code."); return; }
      try {
        const response = await fetch(`${publicSupabaseUrl}/functions/v1/verify-payment`, { method: "POST", headers: { "Content-Type": "application/json", apikey: publicSupabaseAnonKey, Authorization: `Bearer ${publicSupabaseAnonKey}` }, body: JSON.stringify({ reference }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Payment verification is not available right now.");
        if (active && data.status === "paid") { setState("paid"); setMessage("Your payment is confirmed. WearWise can now begin the next step on your order."); }
        else if (active && data.status === "failed") { setState("failed"); setMessage("The payment was not completed. You can try again using the same order code."); }
        else if (active) { setState("pending"); setMessage("Paystack has not confirmed this payment yet. Wait a moment and check again, or contact WearWise if you were charged."); }
      } catch (cause) { if (active) { setState("error"); setMessage(cause instanceof Error ? cause.message : "We could not verify the payment yet."); } }
    }
    void verify();
    return () => { active = false; };
  }, [reference]);

  return <View style={styles.page}><Stack.Screen options={{ headerShown: false }} /><View style={styles.card}>
    <Text style={styles.eyebrow}>{state === "paid" ? "PAYMENT CONFIRMED" : state === "checking" ? "PLEASE WAIT" : "PAYMENT UPDATE"}</Text>
    <Text style={styles.title}>{state === "paid" ? "Thank you!" : state === "checking" ? "Verifying payment" : state === "pending" ? "Still confirming" : "We need to check"}</Text>
    {state === "checking" ? <ActivityIndicator color="#6250B5" style={{ marginVertical: 20 }} /> : <View style={[styles.icon, state === "paid" && styles.success]}><Text style={styles.iconText}>{state === "paid" ? "✓" : "i"}</Text></View>}
    <Text style={styles.body}>{message}</Text>
    {reference ? <Text selectable style={styles.reference}>Reference: {reference}</Text> : null}
    {state === "failed" && orderCode ? <Pressable onPress={() => router.replace({ pathname: "/pay", params: { orderCode } })} style={styles.button}><Text style={styles.buttonText}>Try payment again</Text></Pressable> : null}
    <Pressable onPress={() => router.replace("/")} style={[styles.button, state === "failed" && orderCode ? styles.secondaryButton : null]}><Text style={[styles.buttonText, state === "failed" && orderCode ? styles.secondaryButtonText : null]}>Back to WearWise</Text></Pressable>
  </View></View>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: "#FAF8F3", alignItems: "center", justifyContent: "center", padding: 20 }, card: { width: "100%", maxWidth: 520, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E8E4DC", borderRadius: 24, padding: 28 }, eyebrow: { color: "#6250B5", fontWeight: "800", letterSpacing: 1.4, fontSize: 11 }, title: { color: "#25262B", fontWeight: "800", fontSize: 30, marginTop: 10 }, icon: { width: 48, height: 48, backgroundColor: "#E8E2FF", borderRadius: 24, alignItems: "center", justifyContent: "center", marginTop: 22 }, success: { backgroundColor: "#E8EFE6" }, iconText: { color: "#4D7554", fontSize: 23, fontWeight: "800" }, body: { color: "#77777C", fontSize: 15, lineHeight: 23, marginTop: 16 }, reference: { color: "#77777C", fontSize: 12, marginTop: 16 }, button: { backgroundColor: "#6250B5", borderRadius: 14, padding: 15, alignItems: "center", marginTop: 22 }, buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" }, secondaryButton: { backgroundColor: "#E8E2FF", marginTop: 12 }, secondaryButtonText: { color: "#6250B5" } });
