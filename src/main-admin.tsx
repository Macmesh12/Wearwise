import React, { createContext, useContext, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import Admin from "./Admin";
import "./index.css";
import { supabase } from "./lib/supabase";

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  images: string[];
  stock: string;
  sizeOptions: string[];
  colorOptions: string[];
  description: string;
};
type Design = {
  id: string;
  code: string;
  name: string;
  tags: string[];
  image: string;
  downloadUrl: string;
};

const CatalogContext = createContext<{
  products: Product[];
  designs: Design[];
}>({ products: [], designs: [] });

function AdminApp() {
  const [products, setProducts] = useState<Product[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadCatalog() {
      const [itemResult, designResult] = await Promise.all([
        supabase
          .from("store_items")
          .select(
            "id,name,category,description,price,image_paths,size_options,color_options,stock_quantity",
          )
          .eq("is_published", true)
          .eq("is_available", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("designs")
          .select("id,title,category,image_path,preview_path")
          .eq("published", true)
          .eq("category", "T-shirts")
          .order("created_at", { ascending: false }),
      ]);
      if (!active) return;
      const storeItems = (itemResult.data ?? []) as {
        id: string;
        name: string;
        category: string;
        description: string | null;
        price: number | string;
        image_paths: string[] | null;
        size_options: string[] | null;
        color_options: string[] | null;
        stock_quantity: number | null;
      }[];
      setProducts(
        storeItems.map((item) => {
          const imagePaths = item.image_paths ?? [];
          const images = imagePaths.map(
            (p) =>
              supabase.storage.from("store-items").getPublicUrl(p).data
                .publicUrl,
          );
          return {
            id: item.id,
            name: item.name,
            category: item.category,
            description: item.description ?? "",
            price: Number(item.price) || 0,
            images,
            stock:
              item.stock_quantity !== null && item.stock_quantity < 5
                ? "Low stock"
                : "In stock",
            sizeOptions: item.size_options ?? [],
            colorOptions: item.color_options ?? [],
          };
        }),
      );
      const gallery = (designResult.data ?? []) as {
        id: string;
        title: string | null;
        category: string;
        image_path: string;
        preview_path: string | null;
      }[];
      setDesigns(
        gallery.map((d) => ({
          id: d.id,
          code: d.id,
          name: d.title ?? "",
          tags: [],
          image:
            supabase.storage.from("designs").getPublicUrl(d.image_path).data
              .publicUrl,
          downloadUrl:
            supabase.storage.from("designs").getPublicUrl(d.preview_path ?? "").data
              .publicUrl,
        })),
      );
      setLoading(false);
    }
    loadCatalog();
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <div>Loading admin...</div>;

  return (
    <CatalogContext.Provider value={{ products, designs }}>
      <Admin onExit={() => {}} onCatalogRefresh={() => {}} />
    </CatalogContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>,
);