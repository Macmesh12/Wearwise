import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";

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

const palette = {
  paper: "#F7F7F5",
  ink: "#161616",
  muted: "#747474",
  plum: "#D85C3F",
  violet: "#F2EDE8",
  line: "#E8E6E2",
  white: "#FFFFFF",
  green: "#4D7554",
  softGreen: "#E8EFE6",
};

export default function ShopScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<StoreItem[]>([]);
  const [activeCategory, setActiveCategory] = useState("All items");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(
    () => ["All items", ...Array.from(new Set(items.map((item) => item.category)))],
    [items],
  );
  const visibleItems = items.filter(
    (item) => activeCategory === "All items" || item.category === activeCategory,
  );
  const columns = width >= 1100 ? 4 : width >= 760 ? 3 : 2;
  const padding = width >= 760 ? 36 : 20;
  const gap = width >= 760 ? 18 : 12;
  const cardWidth = (Math.min(width, 1360) - padding * 2 - gap * (columns - 1)) / columns;

  useEffect(() => {
    let cancelled = false;

    async function loadItems() {
      const { data, error: queryError } = await supabase
        .from("store_items")
        .select("id, name, category, description, price, currency_code, image_paths, size_options, color_options, stock_quantity")
        .eq("is_published", true)
        .eq("is_available", true)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (queryError) {
        setError(queryError.message);
      } else {
        setItems((data ?? []) as StoreItem[]);
      }
      setLoading(false);
    }

    void loadItems();
    return () => {
      cancelled = true;
    };
  }, []);

  function imageUrl(path: string) {
    return supabase.storage.from("store-items").getPublicUrl(path).data.publicUrl;
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.content, { paddingHorizontal: padding }]}>
        <View style={styles.header}>
          <View style={styles.brandLockup}>
            <Image source={require("../assets/images/logo.png")} style={styles.logo} resizeMode="contain" />
            <View>
              <Text style={styles.brand}>WearWise</Text>
              <Text style={styles.brandCaption}>THE SHOP</Text>
            </View>
          </View>
          <Pressable onPress={() => router.replace("/")} style={styles.navButton}>
            <Text style={styles.navButtonText}>Explore designs ↗</Text>
          </Pressable>
        </View>

        <View style={[styles.hero, width < 620 && styles.heroMobile]}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>THE WEARWISE SHOP</Text>
            <Text style={[styles.heroTitle, width < 620 && styles.heroTitleMobile]}>Your next favourite starts here.</Text>
            <Text style={styles.heroDescription}>
              Shop pieces that are available now, with delivery usually arranged within one to two days.
            </Text>
            <View style={styles.heroTrustRow}>
              <View style={styles.heroTrustDot} />
              <Text style={styles.heroTrustText}>READY TO ORDER · SECURE CHECKOUT</Text>
            </View>
          </View>
          {items[0]?.image_paths[0] ? (
            <View style={[styles.heroPhotoFrame, width < 620 && styles.heroPhotoFrameMobile]}>
              <Image source={{ uri: imageUrl(items[0].image_paths[0]) }} style={styles.heroPhoto} resizeMode="cover" />
              <View style={styles.heroPhotoCaption}><Text style={styles.heroPhotoCaptionText}>IN THE SHOP NOW</Text></View>
            </View>
          ) : <View style={styles.heroMark}><Text style={styles.heroMarkText}>W</Text></View>}
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionEyebrow}>THE WEARWISE SHOP</Text>
            <Text style={styles.sectionTitle}>Available now</Text>
          </View>
          {!loading && !error ? <Text style={styles.itemCount}>{items.length} {items.length === 1 ? "item" : "items"}</Text> : null}
        </View>

        {categories.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            {categories.map((category) => {
              const selected = activeCategory === category;
              return (
                <Pressable
                  key={category}
                  onPress={() => setActiveCategory(category)}
                  style={[styles.categoryButton, selected && styles.categoryButtonSelected]}
                >
                  <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{category}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {loading ? (
          <ActivityIndicator color={palette.plum} style={styles.message} />
        ) : error ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>We couldn’t load the shop</Text>
            <Text style={styles.emptyText}>{error}</Text>
          </View>
        ) : visibleItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✳</Text>
            <Text style={styles.emptyTitle}>The shop is getting ready</Text>
            <Text style={styles.emptyText}>New ready-to-buy pieces will appear here as soon as they’re added.</Text>
          </View>
        ) : (
          <View style={[styles.grid, { gap }]}>
            {visibleItems.map((item) => (
              <View key={item.id} style={[styles.card, { width: cardWidth }]}>
                <View style={styles.imageFrame}>
                  {item.image_paths[0] ? (
                    <Image source={{ uri: imageUrl(item.image_paths[0]) }} style={styles.itemImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Text style={styles.placeholderIcon}>✳</Text>
                      <Text style={styles.placeholderText}>PHOTO COMING SOON</Text>
                    </View>
                  )}
                  <View style={[styles.availableBadge, item.stock_quantity === 0 && styles.soldOutBadge]}>
                    <View style={[styles.availableDot, item.stock_quantity === 0 && styles.soldOutDot]} />
                    <Text style={[styles.availableText, item.stock_quantity === 0 && styles.soldOutText]}>{item.stock_quantity === 0 ? "SOLD OUT" : "AVAILABLE"}</Text>
                  </View>
                </View>
                <View style={styles.cardCopy}>
                  <Text style={styles.categoryLabel}>{item.category}</Text>
                  <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                  {item.description ? <Text style={styles.itemDescription} numberOfLines={2}>{item.description}</Text> : null}
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>{item.currency_code} {Number(item.price).toFixed(2)}</Text>
                    {item.stock_quantity !== null ? <Text style={styles.stockText}>{item.stock_quantity} left</Text> : null}
                  </View>
                  <Pressable
                    onPress={() => router.push({ pathname: "/shop-checkout", params: { itemId: item.id } })}
                    disabled={item.stock_quantity === 0}
                    style={[styles.buyButton, item.stock_quantity === 0 && styles.buyButtonDisabled]}
                  >
                    <Text style={styles.buyButtonText}>{item.stock_quantity === 0 ? "Sold out" : "Buy this item"}</Text>
                    {item.stock_quantity !== 0 ? <Text style={styles.buyButtonArrow}>↗</Text> : null}
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.deliveryNote}>
          <Text style={styles.deliveryIcon}>↗</Text>
          <View style={styles.deliveryCopy}>
            <Text style={styles.deliveryTitle}>Quick delivery</Text>
            <Text style={styles.deliveryText}>Shop orders are usually ready for delivery the next day or within two days.</Text>
          </View>
        </View>
        <Text style={styles.footer}>WEARWISE · MADE FOR YOUR EVERYDAY</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.paper },
  scrollContent: { flexGrow: 1 },
  content: { width: "100%", maxWidth: 1360, alignSelf: "center", paddingTop: 22, paddingBottom: 48 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 28, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: palette.line },
  brandLockup: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 42, height: 42, borderRadius: 10, backgroundColor: palette.white },
  brand: { color: palette.ink, fontSize: 20, fontWeight: "800", letterSpacing: -0.8 },
  brandCaption: { marginTop: 2, color: palette.muted, fontSize: 8, fontWeight: "700", letterSpacing: 1.7 },
  navButton: { paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: palette.line, borderRadius: 5, backgroundColor: palette.white },
  navButtonText: { color: palette.ink, fontSize: 12, fontWeight: "700" },
  hero: { minHeight: 300, flexDirection: "row", alignItems: "center", justifyContent: "space-between", overflow: "hidden", padding: 42, borderRadius: 8, backgroundColor: "#EEEDEB" },
  heroMobile: { minHeight: 440, flexDirection: "column", alignItems: "stretch", gap: 22, padding: 24 },
  heroCopy: { flex: 1, maxWidth: 570, paddingVertical: 8 },
  eyebrow: { marginBottom: 14, color: palette.plum, fontSize: 9, fontWeight: "900", letterSpacing: 1.7 },
  heroTitle: { maxWidth: 520, color: palette.ink, fontSize: 42, lineHeight: 47, fontWeight: "800", letterSpacing: -1.9 },
  heroTitleMobile: { fontSize: 34, lineHeight: 38 },
  heroDescription: { maxWidth: 440, marginTop: 13, color: "#5D5B58", fontSize: 14, lineHeight: 22 },
  heroTrustRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 24 },
  heroTrustDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.plum },
  heroTrustText: { color: "#575451", fontSize: 8, fontWeight: "800", letterSpacing: 1 },
  heroPhotoFrame: { width: "43%", maxWidth: 440, height: 238, overflow: "hidden", position: "relative", borderRadius: 5, backgroundColor: "#E1DEDA" },
  heroPhotoFrameMobile: { width: "100%", maxWidth: undefined, height: 190 },
  heroPhoto: { width: "100%", height: "100%" },
  heroPhotoCaption: { position: "absolute", left: 12, bottom: 12, paddingVertical: 7, paddingHorizontal: 9, backgroundColor: "rgba(255,255,255,0.94)" },
  heroPhotoCaptionText: { color: palette.ink, fontSize: 8, fontWeight: "800", letterSpacing: 1 },
  heroMark: { width: 170, height: 170, alignItems: "center", justifyContent: "center", marginHorizontal: 65, borderRadius: 85, backgroundColor: "#DEDAD5" },
  heroMarkText: { color: palette.plum, fontSize: 90, fontWeight: "800" },
  sectionHeading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 46, marginBottom: 18 },
  sectionEyebrow: { marginBottom: 5, color: palette.plum, fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  sectionTitle: { color: palette.ink, fontSize: 29, fontWeight: "800", letterSpacing: -1.1 },
  itemCount: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14, color: palette.muted, backgroundColor: "#EFEEE9", fontSize: 10, fontWeight: "700" },
  categoryRow: { flexDirection: "row", gap: 8, paddingBottom: 17 },
  categoryButton: { paddingVertical: 9, paddingHorizontal: 14, borderWidth: 1, borderColor: palette.line, borderRadius: 22, backgroundColor: palette.white },
  categoryButtonSelected: { borderColor: palette.plum, backgroundColor: palette.plum },
  categoryText: { color: palette.ink, fontSize: 11, fontWeight: "700" },
  categoryTextSelected: { color: palette.white },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  card: { overflow: "hidden", borderWidth: 1, borderColor: palette.line, borderRadius: 5, backgroundColor: palette.white },
  imageFrame: { aspectRatio: 0.92, overflow: "hidden", position: "relative", backgroundColor: "#F0EFED" },
  itemImage: { width: "100%", height: "100%" },
  imagePlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F0EDE6" },
  placeholderIcon: { color: "#B8B1C8", fontSize: 45 },
  placeholderText: { marginTop: 6, color: palette.muted, fontSize: 8, fontWeight: "800", letterSpacing: 1.1 },
  availableBadge: { position: "absolute", top: 10, left: 10, flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.94)" },
  availableDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: palette.green },
  availableText: { color: palette.green, fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
  soldOutBadge: { backgroundColor: "rgba(255,255,255,0.95)" },
  soldOutDot: { backgroundColor: "#A45235" },
  soldOutText: { color: "#A45235" },
  cardCopy: { padding: 15 },
  categoryLabel: { marginBottom: 4, color: palette.plum, fontSize: 8, fontWeight: "900", letterSpacing: 0.9, textTransform: "uppercase" },
  itemName: { color: palette.ink, fontSize: 15, lineHeight: 20, fontWeight: "700" },
  itemDescription: { marginTop: 5, color: palette.muted, fontSize: 10, lineHeight: 15 },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: palette.line },
  price: { color: palette.ink, fontSize: 12, fontWeight: "900" },
  stockText: { color: palette.muted, fontSize: 9, fontWeight: "700" },
  buyButton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 4, backgroundColor: palette.ink },
  buyButtonText: { color: palette.white, fontSize: 10, fontWeight: "800" },
  buyButtonArrow: { color: palette.white, fontSize: 14, fontWeight: "700" },
  buyButtonDisabled: { backgroundColor: "#D9D6CF" },
  message: { marginVertical: 36 },
  emptyState: { alignItems: "center", paddingHorizontal: 24, paddingVertical: 42, borderRadius: 19, backgroundColor: palette.white },
  emptyIcon: { marginBottom: 7, color: palette.plum, fontSize: 34 },
  emptyTitle: { color: palette.ink, fontSize: 17, fontWeight: "800", textAlign: "center" },
  emptyText: { maxWidth: 420, marginTop: 7, color: palette.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  deliveryNote: { flexDirection: "row", alignItems: "center", gap: 13, marginTop: 34, padding: 17, borderRadius: 16, backgroundColor: palette.softGreen },
  deliveryIcon: { color: palette.green, fontSize: 24, fontWeight: "800" },
  deliveryCopy: { flex: 1 },
  deliveryTitle: { color: palette.green, fontSize: 12, fontWeight: "800" },
  deliveryText: { marginTop: 3, color: "#557058", fontSize: 10, lineHeight: 15 },
  footer: { marginTop: 28, color: "#96938D", fontSize: 9, fontWeight: "700", textAlign: "center", letterSpacing: 1.4 },
});
