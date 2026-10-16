import { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

const categories = ["All", "Minimal", "Typography", "Illustration", "Retro"];

const designs = [
  {
    id: "sun-club",
    title: "Sun Club",
    category: "Illustration",
    image:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "good-energy",
    title: "Good Energy",
    category: "Typography",
    image:
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "weekend-uniform",
    title: "Weekend Uniform",
    category: "Minimal",
    image:
      "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "soft-life",
    title: "Soft Life",
    category: "Retro",
    image:
      "https://images.unsplash.com/photo-1562157873-818bc0726f68?auto=format&fit=crop&w=900&q=85",
  },
];

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const columns = width >= 1100 ? 4 : width >= 760 ? 3 : 2;
  const pagePadding = width >= 760 ? 36 : 18;
  const contentWidth = Math.min(width, 1280) - pagePadding * 2;
  const cardGap = 16;
  const cardWidth = (contentWidth - cardGap * (columns - 1)) / columns;

  const visibleDesigns = designs.filter((design) => {
    const matchesCategory =
      activeCategory === "All" || design.category === activeCategory;
    const matchesSearch = design.title
      .toLowerCase()
      .includes(search.trim().toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <ScrollView style={styles.page}>
      <View style={[styles.content, { paddingHorizontal: pagePadding }]}>
        <Text style={styles.brand}>WEARWISE</Text>
        <Text style={styles.heading}>Find your next favourite tee.</Text>
        <Text style={styles.intro}>
          Original T-shirt ideas from independent creators.
        </Text>

        <TextInput
          accessibilityLabel="Search designs"
          placeholder="Search designs"
          placeholderTextColor="#77766F"
          value={search}
          onChangeText={setSearch}
          style={styles.search}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
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

        <Text style={styles.resultsHeading}>Discover designs</Text>

        <View style={styles.gallery}>
          {visibleDesigns.map((design) => (
            <View key={design.id} style={{ width: cardWidth }}>
              <Image source={{ uri: design.image }} style={styles.image} />
              <Text style={styles.designTitle}>{design.title}</Text>
              <Text style={styles.designCategory}>{design.category}</Text>
            </View>
          ))}

          {visibleDesigns.length === 0 && (
            <Text style={styles.emptyMessage}>
              No designs found. Try another search.
            </Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F7F6F2",
  },
  content: {
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
    paddingTop: 32,
    paddingBottom: 64,
  },
  brand: {
    color: "#326B52",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 2,
  },
  heading: {
    marginTop: 18,
    color: "#20221F",
    fontSize: 38,
    fontWeight: "700",
  },
  intro: {
    marginTop: 8,
    color: "#696A64",
    fontSize: 16,
  },
  search: {
    height: 48,
    marginTop: 24,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E1E0D9",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    color: "#20221F",
    fontSize: 16,
  },
  categoryList: {
    gap: 10,
    paddingTop: 18,
    paddingBottom: 28,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: "#EAE9E3",
  },
  categoryButtonSelected: {
    backgroundColor: "#326B52",
  },
  categoryText: {
    color: "#454640",
    fontSize: 14,
  },
  categoryTextSelected: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  resultsHeading: {
    marginBottom: 16,
    color: "#20221F",
    fontSize: 22,
    fontWeight: "700",
  },
  gallery: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  image: {
    width: "100%",
    aspectRatio: 0.82,
    borderRadius: 12,
    backgroundColor: "#EAE9E3",
  },
  designTitle: {
    marginTop: 10,
    color: "#20221F",
    fontSize: 16,
    fontWeight: "600",
  },
  designCategory: {
    marginTop: 4,
    marginBottom: 8,
    color: "#77766F",
    fontSize: 13,
  },
  emptyMessage: {
    color: "#696A64",
    fontSize: 16,
  },
});
