import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { supabase } from "../../lib/supabase";

type Category = "T-shirts" | "Jerseys";

type Design = {
  id: string;
  title: string | null;
  category: Category;
  image_path: string;
  preview_path: string | null;
};

const categories: Category[] = ["T-shirts"];

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [designs, setDesigns] = useState<Design[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category>("T-shirts");
  const [selectedDesign, setSelectedDesign] = useState<Design | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const galleryY = useRef(0);
  const introMotion = useRef(new Animated.Value(0)).current;
  const galleryMotion = useRef(new Animated.Value(0)).current;

  const columns = width >= 1100 ? 4 : width >= 760 ? 3 : 2;
  const pagePadding = width >= 760 ? 36 : 20;
  const contentWidth = Math.min(width, 1280) - pagePadding * 2;
  const gap = width >= 760 ? 20 : 12;
  const cardWidth = (contentWidth - gap * (columns - 1)) / columns;

  useEffect(() => {
    Animated.spring(introMotion, {
      toValue: 1,
      damping: 18,
      stiffness: 90,
      useNativeDriver: true,
    }).start();

    let cancelled = false;

    async function loadDesigns() {
      const { data, error: queryError } = await supabase
        .from("designs")
        .select("id, title, category, image_path, preview_path")
        .eq("published", true)
        .eq("category", "T-shirts")
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (queryError) {
        setError(queryError.message);
      } else {
        const shuffledDesigns = [...(data ?? [])];

        for (let i = shuffledDesigns.length - 1; i > 0; i--) {
          const randomIndex = Math.floor(Math.random() * (i + 1));
          [shuffledDesigns[i], shuffledDesigns[randomIndex]] = [
            shuffledDesigns[randomIndex],
            shuffledDesigns[i],
          ];
        }

        setDesigns(shuffledDesigns as Design[]);
      }

      setLoading(false);
    }

    void loadDesigns();

    return () => {
      cancelled = true;
    };
  }, [introMotion]);

  useEffect(() => {
    galleryMotion.setValue(0);
    Animated.timing(galleryMotion, {
      toValue: 1,
      duration: 360,
      useNativeDriver: true,
    }).start();
  }, [activeCategory, galleryMotion]);

  const visibleDesigns = designs.filter(
    (design) => design.category === activeCategory,
  );

  function getImageUrl(path: string) {
    return supabase.storage.from("designs").getPublicUrl(path).data.publicUrl;
  }

  function openGallery() {
    scrollRef.current?.scrollTo({ y: galleryY.current, animated: true });
  }

  function downloadSelectedDesign() {
    if (!selectedDesign) return;

    const downloadUrl = supabase.storage
      .from("designs")
      .getPublicUrl(selectedDesign.image_path, { download: true })
      .data.publicUrl;

    if (Platform.OS === "web") {
      window.location.href = downloadUrl;
    } else {
      void Linking.openURL(downloadUrl);
    }

    setSelectedDesign(null);
  }

  const introStyle = {
    opacity: introMotion,
    transform: [
      {
        translateY: introMotion.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
    ],
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.page}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.content, { paddingHorizontal: pagePadding }]}>
        <View style={styles.header}>
          <View style={styles.brandLockup}>
            <Image
              source={require("../../assets/images/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <View>
              <Text style={styles.brand}>WearWise</Text>
              <Text style={styles.brandCaption}>WEAR YOUR STORY</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push("/shop")}
              style={({ pressed }) => [
                styles.shopNavButton,
                pressed && styles.controlPressed,
              ]}
            >
              <Text style={styles.shopNavButtonText}>Shop</Text>
              <Text style={styles.shopNavButtonArrow}>↗</Text>
            </Pressable>
            <View style={styles.headerTag}>
              <View style={styles.onlineDot} />
              <Text style={styles.headerTagText}>MADE FOR YOU</Text>
            </View>
          </View>
        </View>

        <Animated.View
          style={[styles.hero, width < 620 && styles.heroMobile, introStyle]}
        >
          <View style={[styles.heroCopy, width < 620 && styles.heroCopyMobile]}>
            <View style={styles.eyebrow}>
              <Text style={styles.eyebrowText}>YOUR STYLE, YOUR STORY</Text>
            </View>
            <Text style={[styles.heroTitle, width < 620 && styles.heroTitleMobile]}>
              Wear something{"\n"}
              <Text style={styles.heroTitleAccent}>that feels like you.</Text>
            </Text>
            <Text style={styles.heroDescription}>
              Discover a design you love, or bring your own idea to life.
            </Text>
            <Pressable
              onPress={openGallery}
              style={({ pressed }) => [
                styles.heroButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.heroButtonText}>Explore the collection</Text>
              <Text style={styles.heroButtonArrow}>↘</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/order",
                  params: { orderType: "custom_design" },
                })
              }
              style={({ pressed }) => [
                styles.customRequestLink,
                pressed && styles.linkPressed,
              ]}
            >
              <Text style={styles.customRequestLinkText}>
                Have your own idea? Request a custom design ↗
              </Text>
            </Pressable>
          </View>

          <View style={[styles.heroArt, width < 620 && styles.heroArtMobile]}>
            {visibleDesigns[0] ? (
              <Image source={{ uri: getImageUrl(visibleDesigns[0].preview_path ?? visibleDesigns[0].image_path) }} style={styles.heroDesignImage} resizeMode="cover" />
            ) : <View style={styles.heroImageFallback}><Text style={styles.heroFallbackWord}>WW</Text></View>}
            <View style={styles.heroLabel}>
              <Text style={styles.heroLabelSmall}>WEARWISE</Text>
              <Text style={styles.heroLabelBig}>YOUR NEXT FIT</Text>
            </View>
          </View>
        </Animated.View>

        <View
          style={[styles.promiseRow, width < 620 && styles.promiseRowMobile]}
        >
          <Promise
            compact={width < 620}
            icon="✦"
            title="Made personal"
            detail="Your idea, your way"
          />
          <View
            style={[
              styles.promiseDivider,
              width < 620 && styles.promiseDividerMobile,
            ]}
          />
          <Promise
            compact={width < 620}
            icon="↗"
            title="Made to order"
            detail="Prepared just for you"
          />
          <View
            style={[
              styles.promiseDivider,
              width < 620 && styles.promiseDividerMobile,
            ]}
          />
          <Promise
            compact={width < 620}
            icon="♡"
            title="Made with care"
            detail="From design to delivery"
          />
        </View>

        <View
          onLayout={(event) => {
            galleryY.current = event.nativeEvent.layout.y;
          }}
          style={styles.gallerySection}
        >
          <View
            style={[
              styles.sectionHeadingRow,
              width < 620 && styles.sectionHeadingRowMobile,
            ]}
          >
            <View style={styles.sectionHeadingCopy}>
              <Text style={styles.sectionEyebrow}>THE WEARWISE EDIT</Text>
              <Text style={styles.sectionTitle}>Find your next favourite.</Text>
            </View>
            {width >= 620 ? (
              <Text style={styles.longPressHint}>
                Hold a design to download
              </Text>
            ) : null}
          </View>

          <View style={styles.categoryRow}>
            {categories.map((category) => {
              const selected = activeCategory === category;

              return (
                <Pressable
                  key={category}
                  onPress={() => setActiveCategory(category)}
                  style={({ pressed }) => [
                    styles.categoryButton,
                    selected && styles.categoryButtonSelected,
                    pressed && styles.categoryPressed,
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
                  {selected ? <View style={styles.categoryDot} /> : null}
                </Pressable>
              );
            })}
          </View>

          {loading ? (
            <ActivityIndicator
              color={palette.plum}
              style={[styles.message, styles.loadingState]}
            />
          ) : error ? (
            <Text style={styles.message}>Could not load designs: {error}</Text>
          ) : visibleDesigns.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>
                {activeCategory === "Jerseys" ? "✳" : "♡"}
              </Text>
              <Text style={styles.emptyTitle}>
                {activeCategory === "Jerseys"
                  ? "Jersey designs are coming soon"
                  : "New designs are on the way"}
              </Text>
              <Text style={styles.emptyText}>
                Check back soon for something you’ll love wearing.
              </Text>
            </View>
          ) : (
            <Animated.View
              style={[
                styles.gallery,
                {
                  gap,
                  opacity: galleryMotion,
                  transform: [
                    {
                      translateY: galleryMotion.interpolate({
                        inputRange: [0, 1],
                        outputRange: [10, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {visibleDesigns.map((design, index) => (
                <Pressable
                  key={design.id}
                  onLongPress={() => setSelectedDesign(design)}
                  delayLongPress={500}
                  accessibilityLabel="Long press to open download option"
                  style={({ pressed }) => [
                    styles.designCard,
                    { width: cardWidth },
                    pressed && styles.designCardPressed,
                  ]}
                >
                  <View style={styles.imageFrame}>
                    <Image
                      source={{
                        uri: getImageUrl(
                          design.preview_path ?? design.image_path,
                        ),
                      }}
                      style={styles.designImage}
                      resizeMode="cover"
                    />
                    {index === 0 ? (
                      <View style={styles.featuredBadge}>
                        <Text style={styles.featuredBadgeText}>THE EDIT</Text>
                      </View>
                    ) : null}
                    <View style={styles.cardArrow}>
                      <Text style={styles.cardArrowText}>↗</Text>
                    </View>
                  </View>
                  <View style={styles.designMeta}>
                    <Text style={styles.designTitle} numberOfLines={1}>
                      {design.title ||
                        `WearWise ${activeCategory === "T-shirts" ? "tee" : "jersey"}`}
                    </Text>
                    <Text style={styles.designSubtitle}>
                      Made to make a statement
                    </Text>
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: "/order",
                          params: {
                            orderType: "custom_design",
                            designId: design.id,
                          },
                        })
                      }
                      style={({ pressed }) => [
                        styles.orderDesignButton,
                        pressed && styles.controlPressed,
                      ]}
                    >
                      <Text style={styles.orderDesignButtonText}>
                        Request this design
                      </Text>
                      <Text style={styles.orderDesignButtonArrow}>↗</Text>
                    </Pressable>
                  </View>
                </Pressable>
              ))}
            </Animated.View>
          )}
        </View>

        <View style={styles.bottomNote}>
          <Text style={styles.bottomNoteMark}>✳</Text>
          <Text style={styles.bottomNoteText}>
            See a design you love? Save it, then get in touch to make it yours.
          </Text>
        </View>
        <Text style={styles.footer}>WEARWISE · MADE FOR YOUR EVERYDAY</Text>
      </View>

      <Modal
        transparent
        visible={selectedDesign !== null}
        animationType="fade"
        onRequestClose={() => setSelectedDesign(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Text style={styles.modalIconText}>↓</Text>
            </View>
            <Text style={styles.modalTitle}>Save this design?</Text>
            <Text style={styles.modalDescription}>
              Keep a copy of the original image on your device.
            </Text>

            <Pressable
              onPress={downloadSelectedDesign}
              style={({ pressed }) => [
                styles.modalButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.modalButtonText}>Download image</Text>
              <Text style={styles.modalButtonArrow}>↓</Text>
            </Pressable>

            <Pressable
              onPress={() => setSelectedDesign(null)}
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && styles.linkPressed,
              ]}
            >
              <Text style={styles.cancelButtonText}>Maybe later</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Promise({
  icon,
  title,
  detail,
  compact,
}: {
  icon: string;
  title: string;
  detail: string;
  compact: boolean;
}) {
  return (
    <View style={[styles.promiseItem, compact && styles.promiseItemMobile]}>
      <Text style={styles.promiseIcon}>{icon}</Text>
      <View style={styles.promiseCopy}>
        <Text style={styles.promiseTitle}>{title}</Text>
        <Text style={styles.promiseDetail}>{detail}</Text>
      </View>
    </View>
  );
}

const palette = {
  paper: "#F7F7F5",
  ink: "#17191D",
  muted: "#737780",
  plum: "#D65B3E",
  violet: "#F2EDE8",
  orange: "#D65B3E",
  line: "#E4E6E9",
  white: "#FFFFFF",
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.paper },
  scrollContent: { flexGrow: 1 },
  content: {
    width: "100%",
    maxWidth: 1360,
    alignSelf: "center",
    paddingTop: Platform.OS === "web" ? 24 : 36,
    paddingBottom: 44,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  brandLockup: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 9,
    backgroundColor: palette.white,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  brand: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  brandCaption: {
    marginTop: 1,
    color: "#94A3B8",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.7,
  },
  headerTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(79,70,229,0.12)",
    backgroundColor: "rgba(238,242,255,0.78)",
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  shopNavButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: palette.ink,
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  shopNavButtonText: { color: palette.white, fontSize: 11, fontWeight: "800" },
  shopNavButtonArrow: { color: palette.white, fontSize: 14, lineHeight: 15 },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#818CF8",
  },
  headerTagText: {
    color: palette.plum,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  hero: {
    minHeight: 330,
    flexDirection: "row",
    overflow: "hidden",
    position: "relative",
    padding: 38,
    borderRadius: 7,
    backgroundColor: "#EEEDEB",
  },
  heroMobile: {
    minHeight: 520,
    flexDirection: "column",
    padding: 23,
    paddingBottom: 18,
  },
  heroCopy: {
    zIndex: 2,
    flex: 1,
    maxWidth: 570,
    justifyContent: "center",
    paddingVertical: 8,
  },
  heroCopyMobile: { flex: 0, width: "100%" },
  eyebrow: {
    alignSelf: "flex-start",
    marginBottom: 17,
    paddingHorizontal: 0,
    paddingVertical: 3,
  },
  eyebrowText: {
    color: palette.plum,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  heroTitle: {
    color: palette.ink,
    fontSize: 43,
    lineHeight: 49,
    fontWeight: "800",
    letterSpacing: -1.8,
  },
  heroTitleMobile: { fontSize: 34, lineHeight: 39, letterSpacing: -1.2 },
  heroArtMobile: {
    alignSelf: "center",
    width: "100%",
    minWidth: 0,
    height: 205,
    flex: 0,
  },
  heroTitleAccent: { color: palette.plum },
  heroDescription: {
    maxWidth: 380,
    marginTop: 13,
    color: "#526174",
    fontSize: 15,
    lineHeight: 23,
  },
  heroButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginTop: 26,
    paddingVertical: 13,
    paddingHorizontal: 17,
    borderRadius: 13,
    backgroundColor: palette.ink,
    shadowColor: "#0F172A",
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  buttonPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  controlPressed: { opacity: 0.86, transform: [{ scale: 0.98 }] },
  linkPressed: { opacity: 0.62 },
  heroButtonText: { color: palette.white, fontSize: 13, fontWeight: "700" },
  heroButtonArrow: { color: palette.white, fontSize: 18, lineHeight: 19 },
  customRequestLink: {
    alignSelf: "flex-start",
    marginTop: 16,
    paddingVertical: 7,
  },
  customRequestLinkText: {
    color: palette.plum,
    fontSize: 12,
    fontWeight: "700",
  },
  heroArt: {
    width: "39%",
    minWidth: 220,
    height: 270,
    overflow: "hidden",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 5,
    backgroundColor: "#E5E2DE",
    zIndex: 1,
  },
  heroDesignImage: { width: "100%", height: "100%" },
  heroImageFallback: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center", backgroundColor: "#E5E2DE" },
  heroFallbackWord: { color: palette.plum, fontSize: 72, fontWeight: "900", letterSpacing: -6 },
  orbit: {
    position: "absolute",
    width: 245,
    height: 245,
    borderWidth: 1,
    borderColor: "rgba(98,80,181,0.24)",
    borderRadius: 130,
  },
  sun: {
    position: "absolute",
    right: 22,
    top: 16,
    width: 73,
    height: 73,
    borderRadius: 40,
    backgroundColor: "#F8B398",
  },
  artSticker: {
    width: 156,
    height: 190,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 80,
    borderTopLeftRadius: 34,
    backgroundColor: "#A8C6B0",
    transform: [{ rotate: "-8deg" }],
    shadowColor: "#51428f",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  stickerStar: { color: "#FFF6D8", fontSize: 47, lineHeight: 53 },
  stickerText: {
    marginTop: 2,
    color: "#263629",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 1.2,
    lineHeight: 17,
  },
  heroLabel: {
    position: "absolute",
    right: 0,
    bottom: 20,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.94)",
  },
  heroLabelSmall: {
    color: palette.muted,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  heroLabelBig: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 23,
  },
  heroBlobOne: {
    position: "absolute",
    width: 150,
    height: 150,
    right: -75,
    bottom: -98,
    borderRadius: 90,
    backgroundColor: "rgba(79,70,229,0.1)",
  },
  heroBlobTwo: {
    position: "absolute",
    width: 90,
    height: 90,
    left: "52%",
    top: -54,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.32)",
  },
  promiseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 22,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  promiseRowMobile: {
    alignItems: "flex-start",
    flexDirection: "column",
    gap: 12,
    paddingVertical: 22,
  },
  promiseItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  promiseItemMobile: { justifyContent: "flex-start" },
  promiseIcon: { color: palette.plum, fontSize: 19, fontWeight: "700" },
  promiseCopy: { gap: 2 },
  promiseTitle: { color: palette.ink, fontSize: 12, fontWeight: "700" },
  promiseDetail: { color: palette.muted, fontSize: 10 },
  promiseDivider: { width: 1, height: 30, backgroundColor: palette.line },
  promiseDividerMobile: { display: "none" },
  gallerySection: { paddingTop: 42 },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 22,
  },
  sectionHeadingRowMobile: { alignItems: "flex-start" },
  sectionHeadingCopy: { flex: 1 },
  sectionEyebrow: {
    color: palette.plum,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginBottom: 7,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  longPressHint: { color: palette.muted, fontSize: 11, paddingBottom: 4 },
  categoryRow: { flexDirection: "row", gap: 10, marginBottom: 22 },
  categoryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)",
    borderRadius: 5,
    backgroundColor: palette.white,
  },
  categoryButtonSelected: {
    borderColor: palette.plum,
    backgroundColor: palette.plum,
    shadowColor: palette.plum,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  categoryPressed: { opacity: 0.82 },
  categoryText: { color: palette.ink, fontSize: 12, fontWeight: "700" },
  categoryTextSelected: { color: palette.white },
  categoryDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#F7B899",
  },
  gallery: { flexDirection: "row", flexWrap: "wrap" },
  designCard: {
    marginBottom: 14,
    paddingBottom: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.white,
    shadowColor: "#0F172A",
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  designCardPressed: { opacity: 0.93, transform: [{ scale: 0.985 }] },
  imageFrame: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 5,
    backgroundColor: "#EEEDEB",
  },
  designImage: { width: "100%", aspectRatio: 0.82 },
  featuredBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.88)",
  },
  featuredBadgeText: {
    color: palette.ink,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },
  cardArrow: {
    position: "absolute",
    right: 9,
    bottom: 9,
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.9)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardArrowText: { color: palette.ink, fontSize: 16, fontWeight: "700" },
  designMeta: { paddingHorizontal: 13, paddingTop: 13 },
  designTitle: { color: palette.ink, fontSize: 13, fontWeight: "700" },
  designSubtitle: { marginTop: 3, color: palette.muted, fontSize: 10 },
  orderDesignButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 11,
    borderRadius: 10,
    backgroundColor: palette.violet,
  },
  orderDesignButtonText: {
    color: palette.plum,
    fontSize: 10,
    fontWeight: "800",
  },
  orderDesignButtonArrow: {
    color: palette.plum,
    fontSize: 13,
    fontWeight: "800",
  },
  message: { marginTop: 30, color: palette.ink, fontSize: 15 },
  loadingState: { minHeight: 220 },
  emptyState: {
    alignItems: "center",
    paddingVertical: 52,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: "rgba(255,255,255,0.64)",
  },
  emptyIcon: { color: palette.plum, fontSize: 30, marginBottom: 8 },
  emptyTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyText: {
    marginTop: 6,
    color: palette.muted,
    fontSize: 13,
    textAlign: "center",
  },
  bottomNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 44,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(77,117,84,0.14)",
    backgroundColor: "#EEF6EF",
  },
  bottomNoteMark: { color: "#4D7554", fontSize: 21 },
  bottomNoteText: {
    flex: 1,
    color: "#405343",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  footer: {
    marginTop: 22,
    color: "#96938D",
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 1.4,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "rgba(15,23,42,0.58)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    padding: 28,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(248,250,252,0.98)",
    shadowColor: "#020617",
    shadowOpacity: 0.2,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  modalIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderRadius: 24,
    backgroundColor: palette.violet,
  },
  modalIconText: { color: palette.plum, fontSize: 25, fontWeight: "700" },
  modalTitle: { color: palette.ink, fontSize: 21, fontWeight: "800" },
  modalDescription: {
    marginTop: 7,
    marginBottom: 19,
    color: palette.muted,
    fontSize: 13,
    textAlign: "center",
  },
  modalButton: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: palette.plum,
  },
  modalButtonText: { color: palette.white, fontSize: 14, fontWeight: "700" },
  modalButtonArrow: { color: palette.white, fontSize: 17, fontWeight: "700" },
  cancelButton: { padding: 12, marginTop: 5 },
  cancelButtonText: { color: palette.muted, fontSize: 13, fontWeight: "600" },
});
