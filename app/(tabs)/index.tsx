import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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

const categories: Category[] = ["T-shirts", "Jerseys"];

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const [designs, setDesigns] = useState<Design[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category>("T-shirts");
  const [selectedDesign, setSelectedDesign] = useState<Design | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const columns = width >= 1100 ? 4 : width >= 760 ? 3 : 2;
  const pagePadding = width >= 760 ? 36 : 18;
  const contentWidth = Math.min(width, 1280) - pagePadding * 2;
  const gap = 16;
  const cardWidth = (contentWidth - gap * (columns - 1)) / columns;

  useEffect(() => {
    let cancelled = false;

    async function loadDesigns() {
      const { data, error: queryError } = await supabase
        .from("designs")
        .select("id, title, category, image_path, preview_path")
        .eq("published", true)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (queryError) {
        setError(queryError.message);
      } else {
        setDesigns((data ?? []) as Design[]);
      }

      setLoading(false);
    }

    loadDesigns();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleDesigns = designs.filter(
    (design) => design.category === activeCategory,
  );

  function getImageUrl(path: string) {
    return supabase.storage.from("designs").getPublicUrl(path).data.publicUrl;
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

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={[styles.content, { paddingHorizontal: pagePadding }]}>
        <View style={styles.header}>
          <Image
            source={require("../../assets/images/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brand}>WearWise</Text>
        </View>

        <View style={styles.categoryRow}>
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
        </View>

        {loading ? (
          <ActivityIndicator color="#FFFFFF" style={styles.message} />
        ) : error ? (
          <Text style={styles.message}>Could not load designs: {error}</Text>
        ) : visibleDesigns.length === 0 ? (
          <Text style={styles.message}>
            {activeCategory === "Jerseys"
              ? "Jersey designs are coming soon."
              : "No T-shirt designs found."}
          </Text>
        ) : (
          <View style={styles.gallery}>
            {visibleDesigns.map((design) => (
              <Pressable
                key={design.id}
                onLongPress={() => setSelectedDesign(design)}
                delayLongPress={500}
                accessibilityLabel="Long press to open download option"
                style={{ width: cardWidth }}
              >
                <Image
                  source={{
                    uri: getImageUrl(design.preview_path ?? design.image_path),
                  }}
                  style={styles.designImage}
                  resizeMode="cover"
                />
                {design.title ? (
                  <Text style={styles.designTitle}>{design.title}</Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <Modal
        transparent
        visible={selectedDesign !== null}
        animationType="fade"
        onRequestClose={() => setSelectedDesign(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Design options</Text>

            <Pressable
              onPress={downloadSelectedDesign}
              style={styles.modalButton}
            >
              <Text style={styles.modalButtonText}>Download image</Text>
            </Pressable>

            <Pressable
              onPress={() => setSelectedDesign(null)}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    marginTop: Platform.OS === "web" ? 0 : 24,
    flex: 1,
    backgroundColor: "#080808",
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
    paddingTop: 24,
    paddingBottom: 56,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 28,
  },
  logo: {
    width: 48,
    height: 48,
  },
  brand: {
    color: "#D4AF37",
    fontSize: 25,
    fontWeight: "700",
  },
  categoryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  categoryButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  categoryButtonSelected: {
    borderBottomColor: "#FFFFFF",
  },
  categoryText: {
    color: "#FFFFFF",
    fontSize: 16,
  },
  categoryTextSelected: {
    fontWeight: "700",
  },
  gallery: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  designImage: {
    width: "100%",
    aspectRatio: 0.82,
    borderRadius: 10,
    backgroundColor: "#1C1C1C",
  },
  designTitle: {
    marginTop: 8,
    color: "#FFFFFF",
    fontSize: 15,
  },
  message: {
    marginTop: 32,
    color: "#FFFFFF",
    fontSize: 16,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    padding: 22,
    borderRadius: 14,
    backgroundColor: "#171717",
  },
  modalTitle: {
    marginBottom: 18,
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  modalButton: {
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#2A2A2A",
  },
  modalButtonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    padding: 12,
    marginTop: 8,
  },
  cancelButtonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontSize: 15,
  },
});
