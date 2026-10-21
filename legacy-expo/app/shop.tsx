import { useRouter } from "expo-router";
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
  paper: "#F7F7F3",
  ink: "#0A0A0A",
  muted: "#767670",
  lime: "#C8FF00",
  soft: "#EEEEEA",
  line: "#D7D7D0",
  white: "#FFFFFF",
  charcoal: "#171717",
};

export default function ShopScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<StoreItem[]>([]);
  const [activeCategory, setActiveCategory] = useState("All items");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(
    () => [
      "All items",
      ...Array.from(new Set(items.map((item) => item.category))),
    ],
    [items],
  );
  const visibleItems = items.filter(
    (item) =>
      activeCategory === "All items" || item.category === activeCategory,
  );
  const columns = width >= 1100 ? 4 : width >= 760 ? 3 : 2;
  const padding = width >= 760 ? 36 : 20;
  const gap = width >= 760 ? 18 : 12;
  const cardWidth =
    (Math.min(width, 1360) - padding * 2 - gap * (columns - 1)) / columns;

  useEffect(() => {
    let cancelled = false;

    async function loadItems() {
      const { data, error: queryError } = await supabase
        .from("store_items")
        .select(
          "id, name, category, description, price, currency_code, image_paths, size_options, color_options, stock_quantity",
        )
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
    return supabase.storage.from("store-items").getPublicUrl(path).data
      .publicUrl;
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={[styles.content, { paddingHorizontal: padding }]}>
        <View style={styles.header}>
          <View style={styles.brandLockup}>
            <Image
              source={require("../assets/images/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <View>
              <Text style={styles.brand}>WearWise</Text>
              <Text style={styles.brandCaption}>THE SHOP</Text>
            </View>
          </View>
          <Pressable
            onPress={() => router.replace("/")}
            style={styles.navButton}
          >
            <Text style={styles.navButtonText}>Explore designs ↗</Text>
          </Pressable>
        </View>

        <View style={[styles.hero, width < 620 && styles.heroMobile]}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>WEARWISE / READY TO WEAR</Text>
            <Text
              style={[styles.heroTitle, width < 620 && styles.heroTitleMobile]}
            >
              Wear the{"\n"}
              <Text style={styles.accentTitle}>wise.</Text>
            </Text>
            <Text style={styles.heroDescription}>
              Curated pieces. Limited runs. Ready when you are. Shop available
              items and get them delivered in one to two days.
            </Text>
            <View style={styles.heroFootnote}>
              <View style={styles.heroDot} />
              <Text style={styles.heroFootnoteText}>
                AVAILABLE TO ORDER NOW
              </Text>
            </View>
          </View>
          {items[0]?.image_paths[0] ? (
            <View
              style={[
                styles.heroPhotoFrame,
                width < 620 && styles.heroPhotoFrameMobile,
              ]}
            >
              <Image
                source={{ uri: imageUrl(items[0].image_paths[0]) }}
                style={styles.heroPhoto}
                resizeMode="cover"
              />
              <View style={styles.photoTag}>
                <Text style={styles.photoTagText}>LATEST DROP</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.sectionHeading}>
          <View style={styles.sectionTitleGroup}>
            <Text style={styles.sectionEyebrow}>THE WEARWISE STORE</Text>
            <Text style={styles.sectionTitle}>Shop all</Text>
          </View>
          {!loading && !error ? (
            <Text style={styles.itemCount}>
              {visibleItems.length}{" "}
              {visibleItems.length === 1 ? "piece" : "pieces"}
            </Text>
          ) : null}
        </View>

        {categories.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
          >
            {categories.map((category) => {
              const selected = activeCategory === category;
              return (
                <Pressable
                  key={category}
                  onPress={() => setActiveCategory(category)}
                  style={[
                    styles.categoryButton,
                    selected && styles.categoryButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      selected && styles.categoryTextSelected,
                    ]}
                  >
                    {category}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {loading ? (
          <ActivityIndicator color={palette.ink} style={styles.message} />
        ) : error ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>We couldn’t load the shop</Text>
            <Text style={styles.emptyText}>{error}</Text>
          </View>
        ) : visibleItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No items available yet</Text>
            <Text style={styles.emptyText}>
              New ready-to-buy pieces will appear here as soon as they’re added.
            </Text>
          </View>
        ) : (
          <View style={[styles.grid, { gap }]}>
            {visibleItems.map((item) => (
              <View key={item.id} style={[styles.card, { width: cardWidth }]}>
                <View style={styles.imageFrame}>
                  {item.image_paths[0] ? (
                    <Image
                      source={{ uri: imageUrl(item.image_paths[0]) }}
                      style={styles.itemImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Text style={styles.placeholderText}>
                        Photo coming soon
                      </Text>
                    </View>
                  )}
                  {item.stock_quantity === 0 ? (
                    <View style={styles.soldOutBadge}>
                      <Text style={styles.soldOutText}>Sold out</Text>
                    </View>
                  ) : (
                    <View style={styles.availableBadge}>
                      <View style={styles.badgeDot} />
                      <Text style={styles.availableText}>Available</Text>
                    </View>
                  )}
                </View>
                <View style={styles.cardCopy}>
                  <Text style={styles.categoryLabel}>{item.category}</Text>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  {item.description ? (
                    <Text style={styles.itemDescription} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>
                      {item.currency_code} {Number(item.price).toFixed(2)}
                    </Text>
                    {item.stock_quantity !== null ? (
                      <Text style={styles.stockText}>
                        {item.stock_quantity} left
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/shop-checkout",
                        params: { itemId: item.id },
                      })
                    }
                    disabled={item.stock_quantity === 0}
                    style={[
                      styles.buyButton,
                      item.stock_quantity === 0 && styles.buyButtonDisabled,
                    ]}
                  >
                    <Text style={styles.buyButtonText}>
                      {item.stock_quantity === 0
                        ? "Sold out"
                        : "Shop this piece"}
                    </Text>
                    {item.stock_quantity !== 0 ? (
                      <Text style={styles.buyButtonArrow}>↗</Text>
                    ) : null}
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.paper },
  scrollContent: { flexGrow: 1 },
  content: {
    width: "100%",
    maxWidth: 1440,
    alignSelf: "center",
    paddingTop: 18,
    paddingBottom: 64,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  brandLockup: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: palette.white,
  },
  brand: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  brandCaption: {
    marginTop: 3,
    color: palette.muted,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  navButton: {
    paddingVertical: 11,
    paddingHorizontal: 17,
    borderWidth: 1,
    borderColor: palette.ink,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  navButtonText: { color: palette.ink, fontSize: 11, fontWeight: "800" },
  hero: {
    minHeight: 410,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
    padding: 52,
    borderRadius: 18,
    backgroundColor: palette.charcoal,
  },
  heroMobile: {
    minHeight: 0,
    flexDirection: "column",
    alignItems: "stretch",
    gap: 26,
    padding: 26,
    borderRadius: 16,
  },
  heroCopy: { flex: 1, maxWidth: 600, paddingVertical: 8 },
  eyebrow: {
    marginBottom: 22,
    color: palette.lime,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2.2,
  },
  heroTitle: {
    maxWidth: 580,
    color: palette.white,
    fontSize: 76,
    lineHeight: 72,
    fontWeight: "900",
    letterSpacing: -5.2,
  },
  accentTitle: { color: palette.lime },
  heroTitleMobile: { fontSize: 52, lineHeight: 50, letterSpacing: -3.4 },
  heroDescription: {
    maxWidth: 420,
    marginTop: 20,
    color: "#D0D0CB",
    fontSize: 13,
    lineHeight: 21,
  },
  heroFootnote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 25,
  },
  heroDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: palette.lime,
  },
  heroFootnoteText: {
    color: "#B5B5AF",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  heroPhotoFrame: {
    width: "43%",
    maxWidth: 510,
    height: 306,
    overflow: "hidden",
    position: "relative",
    borderRadius: 14,
    backgroundColor: "#303030",
  },
  heroPhotoFrameMobile: { width: "100%", maxWidth: undefined, height: 210 },
  heroPhoto: { width: "100%", height: "100%" },
  photoTag: {
    position: "absolute",
    right: 14,
    bottom: 14,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: palette.lime,
  },
  photoTagText: {
    color: palette.ink,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 54,
    marginBottom: 20,
  },
  sectionTitleGroup: { gap: 5 },
  sectionEyebrow: {
    color: palette.muted,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.8,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -1.6,
  },
  itemCount: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    color: palette.ink,
    backgroundColor: palette.soft,
    fontSize: 9,
    fontWeight: "800",
  },
  categoryRow: { flexDirection: "row", gap: 9, paddingBottom: 22 },
  categoryButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 999,
    backgroundColor: palette.white,
  },
  categoryButtonSelected: {
    borderColor: palette.ink,
    backgroundColor: palette.ink,
  },
  categoryText: { color: palette.ink, fontSize: 10, fontWeight: "800" },
  categoryTextSelected: { color: palette.lime },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  card: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E7E7E1",
    borderRadius: 15,
    backgroundColor: palette.white,
  },
  imageFrame: {
    aspectRatio: 0.84,
    overflow: "hidden",
    position: "relative",
    backgroundColor: palette.soft,
  },
  itemImage: { width: "100%", height: "100%" },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.soft,
  },
  placeholderText: { color: palette.muted, fontSize: 11, fontWeight: "600" },
  availableBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: palette.white,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#4A8A4A",
  },
  availableText: { color: palette.ink, fontSize: 8, fontWeight: "800" },
  soldOutBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: palette.white,
  },
  soldOutText: { color: palette.ink, fontSize: 8, fontWeight: "800" },
  cardCopy: { padding: 15 },
  categoryLabel: {
    marginBottom: 6,
    color: palette.muted,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  itemName: {
    color: palette.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  itemDescription: {
    marginTop: 6,
    color: palette.muted,
    fontSize: 10,
    lineHeight: 15,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    marginTop: 13,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  price: { color: palette.ink, fontSize: 13, fontWeight: "900" },
  stockText: { color: palette.muted, fontSize: 9, fontWeight: "700" },
  buyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 13,
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: palette.ink,
  },
  buyButtonText: { color: palette.white, fontSize: 9, fontWeight: "900" },
  buyButtonArrow: { color: palette.lime, fontSize: 14, fontWeight: "800" },
  buyButtonDisabled: { backgroundColor: "#B9B9B3" },
  message: { marginVertical: 36 },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 52,
    borderRadius: 18,
    backgroundColor: palette.white,
  },
  emptyIcon: { marginBottom: 7, color: palette.ink, fontSize: 34 },
  emptyTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyText: {
    maxWidth: 420,
    marginTop: 7,
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});
