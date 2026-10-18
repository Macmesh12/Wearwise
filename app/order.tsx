import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { publicSupabaseAnonKey, publicSupabaseUrl, supabase } from "../lib/supabase";

type Category = "T-shirts" | "Jerseys";
type OrderType = "existing_design" | "custom_design";

type Product = {
  id: string;
  name: string;
  category: Category;
  description: string;
  usual_sizes: string[];
  usual_colors: string[];
};

type Design = {
  id: string;
  title: string | null;
  category: Category;
  image_path: string;
  preview_path: string | null;
};

type DeliveryMethod = "campus_handoff" | "sister_office_handoff" | "courier" | "other";

const palette = {
  paper: "#F7F7F5",
  ink: "#17191D",
  muted: "#737780",
  plum: "#D65B3E",
  violet: "#F2EDE8",
  line: "#E4E6E9",
  white: "#FFFFFF",
  green: "#4D7554",
  softGreen: "#E8F2EB",
  red: "#B74A43",
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function OrderRequestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderType?: string; designId?: string }>();
  const { width } = useWindowDimensions();
  const orderType: OrderType = firstParam(params.orderType) === "existing_design"
    ? "existing_design"
    : "custom_design";
  const designId = firstParam(params.designId);
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [design, setDesign] = useState<Design | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orderCode, setOrderCode] = useState<string | null>(null);
  const [artwork, setArtwork] = useState<File | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [customerRequest, setCustomerRequest] = useState("");
  const [printPlacement, setPrintPlacement] = useState("");
  const [customText, setCustomText] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("courier");
  const [deliveryArea, setDeliveryArea] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [rushDaysEarly, setRushDaysEarly] = useState("0");
  const [website, setWebsite] = useState("");

  const selectedProduct = products.find((product) => product.id === productId) ?? null;
  const contentWidth = width >= 860 ? 780 : width - 36;

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      const [{ data: productData, error: productError }, designResult] = await Promise.all([
        supabase
        .from("products")
        .select("id, name, category, description, usual_sizes, usual_colors")
        .eq("is_active", true)
        .eq("category", "T-shirts")
          .order("created_at", { ascending: true }),
        designId
          ? supabase
              .from("designs")
              .select("id, title, category, image_path, preview_path")
              .eq("id", designId)
              .eq("published", true)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (cancelled) return;
      if (productError) {
        setLoadError("We couldn’t load the available shirt types. Please refresh and try again.");
        setLoading(false);
        return;
      }

      const loadedProducts = ((productData ?? []) as Product[]).filter((product) => product.category === "T-shirts");
      setProducts(loadedProducts);
      if (loadedProducts.length > 0) setProductId(loadedProducts[0].id);
      if (designResult.error || !designResult.data) {
        if (designId) setLoadError("That design is no longer available. Return to Explore and choose another.");
      } else {
        const selectedDesign = designResult.data as Design;
        if (selectedDesign.category !== "T-shirts") setLoadError("Explore currently accepts T-shirt design requests only.");
        else setDesign(selectedDesign);
      }
      setLoading(false);
    }

    void loadOptions();
    return () => {
      cancelled = true;
    };
  }, [designId, orderType]);

  const sizeOptions = selectedProduct?.usual_sizes ?? [];
  const colorOptions = selectedProduct?.usual_colors ?? [];
  const deliveryOptions: { value: DeliveryMethod; label: string }[] = [
    { value: "campus_handoff", label: "Campus handoff" },
    { value: "sister_office_handoff", label: "Office handoff" },
    { value: "courier", label: "Courier" },
    { value: "other", label: "Other" },
  ];

  const designImageUrl = useMemo(() => {
    if (!design) return null;
    return supabase.storage.from("designs").getPublicUrl(design.preview_path ?? design.image_path).data.publicUrl;
  }, [design]);

  function chooseArtwork() {
    if (Platform.OS !== "web") {
      setSubmitError("You can submit the request now and send your artwork separately after we contact you.");
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        setSubmitError("Artwork must be 5 MB or smaller.");
        return;
      }
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        setSubmitError("Choose a PNG, JPG, or WebP image.");
        return;
      }
      setSubmitError(null);
      setArtwork(file);
    };
    input.click();
  }

  async function submitRequest() {
    setSubmitError(null);
    const selectedQuantity = Number(quantity);
    const urgentDays = Number(rushDaysEarly || 0);

    if (!selectedProduct) {
      setSubmitError("We can’t accept a design request right now. Please try again later.");
      return;
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      setSubmitError("Enter your name and phone number so WearWise can contact you.");
      return;
    }
    if (!size.trim() || !color.trim()) {
      setSubmitError("Tell us the size and color you would like. We’ll confirm availability before production.");
      return;
    }
    if (!Number.isInteger(selectedQuantity) || selectedQuantity < 1 || selectedQuantity > 20) {
      setSubmitError("Choose a quantity between 1 and 20.");
      return;
    }
    if (!Number.isInteger(urgentDays) || urgentDays < 0 || urgentDays > 6) {
      setSubmitError("Urgent requests can be up to six days earlier than standard delivery.");
      return;
    }

    setSubmitting(true);
    const payload = {
      orderType,
      productId: selectedProduct.id,
      designId: design?.id ?? null,
      size: size.trim(),
      color: color.trim(),
      quantity: selectedQuantity,
      customerRequest: customerRequest.trim(),
      rushDaysEarly: urgentDays,
      customization: {
        printPlacement: printPlacement.trim(),
        customText: customText.trim(),
      },
      customer: {
        name: customerName.trim(),
        phone: customerPhone.trim(),
        email: customerEmail.trim(),
      },
      delivery: {
        method: deliveryMethod,
        area: deliveryArea.trim(),
        address: deliveryAddress.trim(),
        instructions: deliveryInstructions.trim(),
      },
    };

    const formData = new FormData();
    formData.append("payload", JSON.stringify(payload));
    formData.append("website", website);
    if (artwork) formData.append("artwork", artwork, artwork.name);

    try {
      const response = await fetch(`${publicSupabaseUrl}/functions/v1/create-order`, {
        method: "POST",
        headers: {
          apikey: publicSupabaseAnonKey,
          Authorization: `Bearer ${publicSupabaseAnonKey}`,
        },
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setSubmitError(result.error || "We couldn’t send the request. Please try again.");
        setSubmitting(false);
        return;
      }
      setOrderCode(result.orderCode);
    } catch {
      setSubmitError("We couldn’t connect to WearWise. Check your internet connection and try again.");
    }
    setSubmitting(false);
  }

  if (orderCode) {
    return (
      <View style={styles.page}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.successCard, { width: contentWidth }]}>
          <View style={styles.successIcon}><Text style={styles.successIconText}>✓</Text></View>
          <Text style={styles.eyebrow}>REQUEST RECEIVED</Text>
          <Text style={styles.successTitle}>Thanks, {customerName.split(" ")[0]}.</Text>
          <Text style={styles.bodyText}>
            Your request is with WearWise. We’ll first check that we can source your requested size and colour and make the design. Then we’ll confirm the price with you on WhatsApp.
          </Text>
          <View style={styles.orderCodeCard}>
            <Text style={styles.fieldLabel}>YOUR REQUEST CODE</Text>
            <Text style={styles.successCode}>{orderCode}</Text>
          </View>
          <Text style={styles.smallNote}>
            You’ll only be asked to pay after we confirm we can make your order and agree on the price. We begin the design work after your payment is confirmed.
          </Text>
          <Pressable onPress={() => router.replace("/")} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Back to the collection</Text>
            <Text style={styles.primaryButtonArrow}>↗</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={[styles.content, { width: contentWidth }]}>
            <View style={styles.topBar}>
              <Pressable onPress={() => router.back()} style={styles.backButton}>
                <Text style={styles.backButtonText}>← Back</Text>
              </Pressable>
              <View style={styles.brandRow}>
                <Image source={require("../assets/images/logo.png")} style={styles.logo} resizeMode="contain" />
                <Text style={styles.brand}>WearWise</Text>
              </View>
            </View>

            <View style={styles.pageIntro}>
              <View style={styles.eyebrowPill}><Text style={styles.eyebrow}>MADE AROUND YOUR IDEA</Text></View>
              <Text style={styles.pageTitle}>{design ? "Make this design yours." : "Let’s create your look."}</Text>
              <Text style={styles.introText}>
                Share your idea and requested size and colour. We’ll check availability and confirm the price with you on WhatsApp before you pay.
              </Text>
            </View>

            {loading ? (
              <View style={styles.loadingBox}><ActivityIndicator color={palette.plum} /><Text style={styles.helpText}>Loading request options…</Text></View>
            ) : loadError ? (
              <View style={styles.errorBox}><Text style={styles.errorText}>{loadError}</Text></View>
            ) : !selectedProduct ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>
                  We’re not accepting custom T-shirt requests right now. Please check back soon.
                </Text>
              </View>
            ) : (
              <>
                {design ? (
                  <View style={styles.selectedDesignCard}>
                    {designImageUrl ? <Image source={{ uri: designImageUrl }} style={styles.selectedDesignImage} resizeMode="cover" /> : null}
                    <View style={styles.selectedDesignCopy}>
                      <Text style={styles.eyebrow}>SELECTED FROM THE COLLECTION</Text>
                      <Text style={styles.selectedDesignTitle}>{design.title || `${design.category} design`}</Text>
                    </View>
                  </View>
                ) : null}

                <View style={styles.formCard}>
                  <Step number="01" title="Your T-shirt" detail="There’s one shirt type for now. We’ll check your requested size and colour before confirming." />
                  {selectedProduct.description ? <Text style={styles.helpText}>{selectedProduct.description}</Text> : null}

                  <View style={styles.twoColumns}>
                    <ChoiceField label="Requested size" value={size} onChangeText={setSize} options={sizeOptions} placeholder="Choose or type a size" />
                    <ChoiceField label="Requested color" value={color} onChangeText={setColor} options={colorOptions} placeholder="Choose or type a color" />
                  </View>

                  <Field label="Quantity" value={quantity} onChangeText={setQuantity} placeholder="1" keyboardType="number-pad" />
                </View>

                <View style={styles.formCard}>
                  <Step number="02" title={orderType === "custom_design" ? "Share your design idea" : "Personalize your design"} detail="Tell us what you want printed or changed." />
                  {orderType === "custom_design" ? (
                    <View style={styles.uploadPanel}>
                      <View style={styles.uploadTextBlock}>
                        <Text style={styles.uploadTitle}>Have artwork or a reference?</Text>
                        <Text style={styles.helpText}>PNG, JPG, or WebP · up to 5 MB · kept private</Text>
                        {Platform.OS !== "web" ? <Text style={styles.helpText}>You can send the file separately after we contact you.</Text> : null}
                      </View>
                      <Pressable onPress={chooseArtwork} style={styles.uploadButton}>
                        <Text style={styles.uploadButtonText}>{artwork ? "Change image" : "Attach image"}</Text>
                      </Pressable>
                      {artwork ? <Text style={styles.fileName}>Selected: {artwork.name}</Text> : null}
                    </View>
                  ) : null}

                  <View style={styles.twoColumns}>
                    <Field label="Print placement" value={printPlacement} onChangeText={setPrintPlacement} placeholder="Front, back, or sleeve" />
                    <Field label="Custom text" value={customText} onChangeText={setCustomText} placeholder="Name, phrase, or leave blank" />
                  </View>
                  <Field
                    label={orderType === "custom_design" ? "Describe your idea or requested changes" : "Anything else you’d like changed?"}
                    value={customerRequest}
                    onChangeText={setCustomerRequest}
                    placeholder="Colors, style, print details, or anything else we should know"
                    multiline
                  />
                </View>

                <View style={styles.formCard}>
                  <Step number="03" title="Delivery and timing" detail="Choose how you’d like to receive your order." />
                  <Text style={styles.fieldLabel}>Delivery method</Text>
                  <View style={styles.choiceChips}>
                    {deliveryOptions.map((option) => (
                      <Chip
                        key={option.value}
                        label={option.label}
                        selected={deliveryMethod === option.value}
                        onPress={() => setDeliveryMethod(option.value)}
                      />
                    ))}
                  </View>
                  <View style={styles.twoColumns}>
                    <Field label="Area or campus" value={deliveryArea} onChangeText={setDeliveryArea} placeholder="For example, Legon" />
                    {deliveryMethod === "courier" ? (
                      <Field label="Delivery address" value={deliveryAddress} onChangeText={setDeliveryAddress} placeholder="Street, landmark, and area" />
                    ) : null}
                  </View>
                  <Field label="Delivery instructions (optional)" value={deliveryInstructions} onChangeText={setDeliveryInstructions} placeholder="Anything that will help us arrange the handoff" />
                  <View style={styles.rushPanel}>
                    <View style={styles.rushCopy}>
                      <Text style={styles.fieldLabel}>Need it sooner?</Text>
                      <Text style={styles.helpText}>Standard estimated delivery is up to 1 week. Each earlier day adds a 20% rush fee to the item subtotal.</Text>
                    </View>
                    <View style={styles.rushDaysField}>
                      <Text style={styles.fieldLabel}>Days earlier</Text>
                      <TextInput value={rushDaysEarly} onChangeText={setRushDaysEarly} keyboardType="number-pad" style={styles.input} />
                    </View>
                  </View>
                </View>

                <View style={styles.formCard}>
                  <Step number="04" title="Your contact details" detail="We’ll use these to confirm your quote and payment." />
                  <View style={styles.twoColumns}>
                    <Field label="Full name" value={customerName} onChangeText={setCustomerName} placeholder="Your name" />
                    <Field label="Phone number" value={customerPhone} onChangeText={setCustomerPhone} placeholder="Your best contact number" keyboardType="phone-pad" />
                  </View>
                  <Field label="Email (optional)" value={customerEmail} onChangeText={setCustomerEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
                </View>

                <View style={styles.paymentPromise}>
                  <Text style={styles.paymentPromiseMark}>✓</Text>
                  <Text style={styles.paymentPromiseText}>
                    First, we’ll confirm on WhatsApp that your requested size and colour are available and that we can make the design. You’ll agree to the price and pay before we begin designing.
                  </Text>
                </View>

                <View style={styles.honeypot}>
                  <TextInput value={website} onChangeText={setWebsite} accessibilityLabel="Website" />
                </View>
                {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}
                <Pressable
                  onPress={() => void submitRequest()}
                  disabled={submitting}
                  style={({ pressed }) => [styles.submitButton, pressed && styles.submitButtonPressed, submitting && styles.disabledButton]}
                >
                  {submitting ? <ActivityIndicator color={palette.white} /> : <Text style={styles.submitButtonText}>Send my request</Text>}
                  {!submitting ? <Text style={styles.submitButtonArrow}>↗</Text> : null}
                </Pressable>
                <Text style={styles.privacyFootnote}>Your contact details and artwork are private and used only to manage this request.</Text>
              </>
            )}
            <Text style={styles.footer}>WEARWISE · MADE FOR YOUR EVERYDAY</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Step({ number, title, detail }: { number: string; title: string; detail: string }) {
  return (
    <View style={styles.stepHeader}>
      <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{number}</Text></View>
      <View style={styles.stepCopy}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.helpText}>{detail}</Text>
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "number-pad" | "decimal-pad" | "phone-pad" | "email-address";
  multiline?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#99969A"
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize={autoCapitalize ?? "sentences"}
        style={[styles.input, multiline && styles.textArea]}
      />
    </View>
  );
}

function ChoiceField({
  label,
  value,
  onChangeText,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {options.length > 0 ? (
        <View style={styles.choiceChips}>
          {options.map((option) => (
            <Chip key={option} label={option} selected={value === option} onPress={() => onChangeText(option)} />
          ))}
        </View>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#99969A"
        style={styles.input}
      />
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flex: 1, alignItems: "center", backgroundColor: palette.paper },
  scrollContent: { alignItems: "center", paddingHorizontal: 18, paddingBottom: 36 },
  content: { maxWidth: 780, paddingTop: Platform.OS === "web" ? 18 : 32, paddingBottom: 16, gap: 15 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 4 },
  backButton: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 18, backgroundColor: palette.white },
  backButtonText: { color: palette.ink, fontSize: 12, fontWeight: "700" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  logo: { width: 36, height: 36, borderRadius: 10, backgroundColor: palette.white },
  brand: { color: palette.ink, fontSize: 17, fontWeight: "800" },
  pageIntro: { paddingVertical: 8 },
  eyebrowPill: { alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 9, borderRadius: 15, backgroundColor: palette.violet },
  eyebrow: { color: palette.plum, fontSize: 8, fontWeight: "900", letterSpacing: 1.3 },
  pageTitle: { marginTop: 9, color: palette.ink, fontSize: 31, lineHeight: 37, fontWeight: "900", letterSpacing: -1 },
  introText: { maxWidth: 570, marginTop: 7, color: palette.muted, fontSize: 14, lineHeight: 21 },
  loadingBox: { minHeight: 160, alignItems: "center", justifyContent: "center", gap: 12 },
  errorBox: { padding: 18, borderRadius: 16, backgroundColor: "#FBE9DE" },
  errorText: { color: palette.red, fontSize: 13, lineHeight: 20 },
  formCard: { padding: 19, borderRadius: 18, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.white, gap: 15 },
  stepHeader: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 2 },
  stepNumber: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: palette.violet },
  stepNumberText: { color: palette.plum, fontSize: 10, fontWeight: "900" },
  stepCopy: { flex: 1, gap: 3 },
  stepTitle: { color: palette.ink, fontSize: 16, fontWeight: "800" },
  helpText: { color: palette.muted, fontSize: 11, lineHeight: 17 },
  productChoices: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  productChoice: { flexGrow: 1, flexBasis: 190, padding: 13, borderWidth: 1, borderColor: palette.line, borderRadius: 13, backgroundColor: "#FDFCF9", gap: 4 },
  productChoiceActive: { borderColor: palette.plum, backgroundColor: palette.violet },
  productChoiceCategory: { color: palette.muted, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  productChoiceCategoryActive: { color: palette.plum },
  productChoiceName: { color: palette.ink, fontSize: 13, fontWeight: "800" },
  productChoiceNameActive: { color: palette.ink },
  productChoiceDescription: { color: palette.muted, fontSize: 10, lineHeight: 15 },
  productChoiceDescriptionActive: { color: "#5C5868" },
  productChoiceAvailability: { marginTop: 4, color: "#9B765B", fontSize: 9, fontWeight: "700" },
  productChoiceAvailabilityActive: { color: palette.plum },
  twoColumns: { flexDirection: "row", flexWrap: "wrap", gap: 13 },
  field: { flex: 1, flexBasis: 220, gap: 6 },
  fieldLabel: { color: palette.ink, fontSize: 11, fontWeight: "700" },
  input: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: palette.line, borderRadius: 10, color: palette.ink, backgroundColor: "#FDFCF9", fontSize: 14 },
  textArea: { minHeight: 88, textAlignVertical: "top" },
  choiceChips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { paddingVertical: 7, paddingHorizontal: 10, borderWidth: 1, borderColor: palette.line, borderRadius: 18, backgroundColor: palette.white },
  chipSelected: { borderColor: palette.plum, backgroundColor: palette.plum },
  chipText: { color: palette.ink, fontSize: 10, fontWeight: "700" },
  chipTextSelected: { color: palette.white },
  uploadPanel: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 13, borderWidth: 1, borderStyle: "dashed", borderColor: "#C8BFEF", borderRadius: 13, backgroundColor: "#F7F4FF" },
  uploadTextBlock: { flex: 1, minWidth: 190, gap: 3 },
  uploadTitle: { color: palette.ink, fontSize: 12, fontWeight: "800" },
  uploadButton: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 9, backgroundColor: palette.violet },
  uploadButtonText: { color: palette.plum, fontSize: 10, fontWeight: "800" },
  fileName: { width: "100%", color: palette.green, fontSize: 10, fontWeight: "700" },
  selectedDesignCard: { flexDirection: "row", alignItems: "center", gap: 13, padding: 11, borderRadius: 14, backgroundColor: palette.violet },
  selectedDesignImage: { width: 56, height: 68, borderRadius: 9, backgroundColor: "#E4DDF8" },
  selectedDesignCopy: { flex: 1, gap: 5 },
  selectedDesignTitle: { color: palette.ink, fontSize: 14, fontWeight: "800" },
  rushPanel: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 14, padding: 13, borderRadius: 12, backgroundColor: "#F7F4EE" },
  rushCopy: { flex: 1, minWidth: 190, gap: 5 },
  rushDaysField: { width: 130, gap: 6 },
  paymentPromise: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 14, backgroundColor: palette.softGreen },
  paymentPromiseMark: { width: 20, height: 20, overflow: "hidden", borderRadius: 10, color: palette.white, backgroundColor: palette.green, fontSize: 12, fontWeight: "900", textAlign: "center" },
  paymentPromiseText: { flex: 1, color: "#405343", fontSize: 11, lineHeight: 17, fontWeight: "600" },
  honeypot: { position: "absolute", width: 1, height: 1, opacity: 0, left: -10000, top: -10000 },
  submitButton: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, padding: 14, borderRadius: 13, backgroundColor: palette.plum },
  submitButtonPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  disabledButton: { opacity: 0.55 },
  submitButtonText: { color: palette.white, fontSize: 14, fontWeight: "800" },
  submitButtonArrow: { color: palette.white, fontSize: 17, fontWeight: "800" },
  privacyFootnote: { color: palette.muted, fontSize: 9, textAlign: "center" },
  footer: { marginTop: 8, color: "#96938D", fontSize: 9, fontWeight: "700", textAlign: "center", letterSpacing: 1.4 },
  successCard: { alignSelf: "center", marginTop: 55, padding: 25, borderRadius: 22, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.white, gap: 13 },
  successIcon: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: palette.softGreen },
  successIconText: { color: palette.green, fontSize: 24, fontWeight: "900" },
  successTitle: { color: palette.ink, fontSize: 27, fontWeight: "900", letterSpacing: -0.8 },
  bodyText: { color: palette.ink, fontSize: 13, lineHeight: 20 },
  orderCodeCard: { alignItems: "center", gap: 5, padding: 14, borderRadius: 14, backgroundColor: palette.violet },
  successCode: { color: palette.plum, fontSize: 21, fontWeight: "900", letterSpacing: 1.1 },
  smallNote: { color: palette.muted, fontSize: 11, lineHeight: 17 },
  primaryButton: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 13, borderRadius: 11, backgroundColor: palette.ink },
  primaryButtonText: { color: palette.white, fontSize: 12, fontWeight: "800" },
  primaryButtonArrow: { color: palette.white, fontSize: 15, fontWeight: "800" },
});
