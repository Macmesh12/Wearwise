import { createContext, useContext, useEffect, useMemo, useState } from "react";
import Admin from "./Admin";
import {
  publicSupabaseAnonKey,
  publicSupabaseUrl,
  supabase,
} from "./lib/supabase";

type Page =
  | "home"
  | "shop"
  | "product"
  | "cart"
  | "checkout"
  | "payment-return"
  | "explore"
  | "design"
  | "request"
  | "track"
  | "contact"
  | "admin";

const photos = {
  hero: "https://images.unsplash.com/photo-1766149756155-4a8122ad0732?auto=format&fit=crop&w=1400&q=85",
  black:
    "https://images.unsplash.com/photo-1761637316697-c7f4e4d7b49f?auto=format&fit=crop&w=900&q=85",
  seated:
    "https://images.unsplash.com/photo-1694677817568-45cea7a9cc83?auto=format&fit=crop&w=900&q=85",
  duo: "https://images.unsplash.com/photo-1765152332677-e7a6886c4f7b?auto=format&fit=crop&w=900&q=85",
  white:
    "https://images.unsplash.com/photo-1780566035923-a394a4f8ce1d?auto=format&fit=crop&w=900&q=85",
  chair:
    "https://images.unsplash.com/photo-1777447458426-43f11f1f7667?auto=format&fit=crop&w=900&q=85",
  portrait:
    "https://images.unsplash.com/photo-1763750581767-b367bcd6c117?auto=format&fit=crop&w=900&q=85",
};

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
type AppliedDiscount = {
  id: string;
  code: string;
  type: "percentage" | "fixed";
  value: number | string;
  max_cap: number | string | null;
  amount: number | string;
};
const CatalogContext = createContext<{
  products: Product[];
  designs: Design[];
}>({ products: [], designs: [] });
const useCatalog = () => useContext(CatalogContext);

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    cart: (
      <>
        <path d="M3 4h2l2 11h10l2-8H6" />
        <circle cx="9" cy="19" r="1" />
        <circle cx="17" cy="19" r="1" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M14 7l5 5-5 5" />
      </>
    ),
    sort: (
      <>
        <path d="M3 9l4-4l4 4m-4-4v14" strokeLinecap="round" />
        <path d="M21 15l-4 4l-4-4m4 4v-14" strokeLinecap="round" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    minus: (
      <>
        <path d="M5 12h14" />
      </>
    ),
    close: (
      <>
        <path d="m6 6 12 12M18 6 6 18" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="11" height="11" rx="2" />
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
      </>
    ),
    whatsapp: (
      <>
        <path d="M20 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.2A8.5 8.5 0 1 1 20 11.5Z" />
        <path d="M8.5 8.5c.4 3 2 4.6 5 5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    home: (
      <>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </>
    ),
    order: (
      <>
        <path d="M3 7l9-3 9 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <path d="M7 12v4a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-4" />
        <circle cx="7.5" cy="19" r="1" />
        <circle cx="16.5" cy="19" r="1" />
      </>
    ),
    user: (
      <>
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function Button({
  children,
  onClick,
  variant = "primary",
  className = "",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline" | "lime" | "ghost" | "pay";
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`btn btn-${variant} ${className}`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  placeholder,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  type?: string;
  value?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </label>
  );
}

function SelectField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select>{children}</select>
    </label>
  );
}

function TextArea({
  label,
  placeholder,
}: {
  label: string;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea rows={4} placeholder={placeholder} />
    </label>
  );
}

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [page, setPage] = useState<Page>(() =>
    window.location.pathname === "/admin"
      ? "admin"
      : window.location.pathname === "/payment-return"
        ? "payment-return"
        : "home",
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [cartSize, setCartSize] = useState("");
  const [cartColor, setCartColor] = useState("");
  const [discount, setDiscount] = useState<AppliedDiscount | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedDesign, setSelectedDesign] = useState<Design | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    let active = true;
    async function loadCatalog() {
      if (window.location.pathname === "/admin") {
        setCatalogLoading(false);
        return;
      }
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
      if (itemResult.error || designResult.error)
        setCatalogError(
          "We could not load the catalogue. Refresh to try again.",
        );
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
        gallery.map((design) => ({
          id: design.id,
          code: design.id.slice(0, 8).toUpperCase(),
          name: design.title?.trim() || "WearWise Design",
          tags: [design.category],
          image: supabase.storage
            .from("designs")
            .getPublicUrl(design.preview_path || design.image_path).data
            .publicUrl,
          downloadUrl: supabase.storage
            .from("designs")
            .getPublicUrl(design.image_path, { download: true }).data.publicUrl,
        })),
      );
      setCatalogLoading(false);
    }
    void loadCatalog();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onPopState = () =>
      setPage(
        window.location.pathname === "/admin"
          ? "admin"
          : window.location.pathname === "/payment-return"
            ? "payment-return"
            : "home",
      );
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const pageTitles: Partial<Record<Page, string>> = {
      home: "WearWise | Ghanaian Streetwear",
      shop: "Shop | WearWise",
      cart: "Your Cart | WearWise",
      checkout: "Checkout | WearWise",
      explore: "Design Archive | WearWise",
      request: selectedDesign
        ? "Request This Design | WearWise"
        : "Request a Custom Design | WearWise",
      track: "Track Your Order | WearWise",
      contact: "Contact WearWise",
      "payment-return": "Payment Update | WearWise",
      admin: "Admin | WearWise",
    };
    document.title =
      page === "product" && selectedProduct
        ? `${selectedProduct.name} | WearWise`
        : page === "design" && selectedDesign
          ? `${selectedDesign.name} | WearWise`
          : (pageTitles[page] ?? "WearWise | Ghanaian Streetwear");
  }, [page, selectedProduct, selectedDesign]);

  const go = (next: Page) => {
    setPage(next);
    const targetPath =
      next === "admin"
        ? "/admin"
        : next === "payment-return"
          ? "/payment-return"
          : "/";
    if (window.location.pathname !== targetPath)
      window.history.pushState({}, "", targetPath);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const add = (
    product?: Product,
    quantity = 1,
    options?: { size: string; color: string },
  ) => {
    if (product) {
      setSelectedProduct(product);
      setCartSize(options?.size ?? product.sizeOptions[0] ?? "");
      setCartColor(options?.color ?? product.colorOptions[0] ?? "");
    } else if (options) {
      setCartSize(options.size);
      setCartColor(options.color);
    }
    setCartCount((count) => Math.min(20, count + quantity));
    setToast("Added to your cart");
    window.setTimeout(() => setToast(""), 1800);
  };

  if (page === "admin") return <Admin onExit={() => go("home")} />;
  if (page === "payment-return") return <PaymentReturn go={go} />;

  return (
    <CatalogContext.Provider value={{ products, designs }}>
      <div className="app">
        <div className="ticker">
          <span>FREE DELIVERY TO ALL UNIVERSITIES WITHIN ACCRA</span>
          <span>MADE FOR THE BOLD • DESIGNED IN GHANA</span>
        </div>
        <header className="header">
          <button className="logo" onClick={() => go("home")}>
            WEAR<span>WISE</span>
          </button>
          <nav className={menuOpen ? "nav nav-open" : "nav"}>
            <button
              className={page === "shop" ? "active" : ""}
              onClick={() => go("shop")}
            >
              Shop
            </button>
            <button
              className={page === "explore" ? "active" : ""}
              onClick={() => go("explore")}
            >
              Explore
            </button>
            <button
              className={page === "track" ? "active" : ""}
              onClick={() => go("track")}
            >
              Track Order
            </button>
          </nav>
          <div className="header-actions">
            <button
              className="cart-btn"
              onClick={() => go("cart")}
              aria-label="Cart"
            >
              <Icon name="cart" />
              <span>{cartCount}</span>
            </button>
          </div>
        </header>

        <main>
          {catalogLoading && (
            <div className="page-loading">
              <div className="spinner" />
            </div>
          )}
          {catalogError && (
            <div role="alert" className="catalog-message">
              {catalogError}
            </div>
          )}
          {page === "home" && (
            <Home
              go={go}
              selectProduct={(p) => {
                setSelectedProduct(p);
                go("product");
              }}
            />
          )}
          {page === "shop" && (
            <Shop
              selectProduct={(p) => {
                setSelectedProduct(p);
                go("product");
              }}
              add={add}
            />
          )}
          {page === "product" && selectedProduct && (
            <ProductDetail
              key={selectedProduct.id}
              product={selectedProduct}
              add={(quantity, size, color) =>
                add(undefined, quantity, { size, color })
              }
              go={go}
              selectProduct={setSelectedProduct}
            />
          )}
          {page === "cart" && (
            <Cart
              go={go}
              product={selectedProduct}
              count={cartCount}
              setCount={(nextCount) => {
                setCartCount(nextCount);
                setDiscount(null);
              }}
              clearCart={() => {
                setCartCount(0);
                setSelectedProduct(null);
                setDiscount(null);
              }}
              discount={discount}
              onDiscountApplied={setDiscount}
            />
          )}
          {page === "checkout" && (
            <Checkout
              go={go}
              product={selectedProduct}
              count={cartCount}
              size={cartSize}
              color={cartColor}
              discount={discount}
            />
          )}
          {page === "explore" && (
            <Explore
              selectDesign={(d) => {
                setSelectedDesign(d);
                go("design");
              }}
            />
          )}
          {page === "design" && selectedDesign && (
            <DesignDetail design={selectedDesign} go={go} />
          )}
          {page === "request" && (
            <RequestForm design={selectedDesign} go={go} />
          )}
          {page === "track" && <Track />}
          {page === "contact" && <Contact />}
        </main>

        <Footer
          go={go}
          openCustomRequest={() => {
            setSelectedDesign(null);
            go("request");
          }}
        />
        {toast && (
          <div className="toast">
            <Icon name="check" />
            {toast}
          </div>
        )}
        <BottomNav page={page} cartCount={cartCount} go={go} />
      </div>
    </CatalogContext.Provider>
  );
}

function BottomNav({
  page,
  cartCount,
  go,
}: {
  page: Page;
  cartCount: number;
  go: (p: Page) => void;
}) {
  const navItems = [
    { label: "Home", page: "home" as Page, icon: "home" },
    { label: "Explore", page: "explore" as Page, image: "/explore.png" },
    { label: "Shop", page: "shop" as Page, image: "/shop.png" },
    { label: "Orders", page: "track" as Page, image: "/orders.png" },
    { label: "Profile", page: "contact" as Page, icon: "user" },
  ];

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <button
          key={item.label}
          className={`bottom-nav-item${page === item.page ? " active" : ""}`}
          onClick={() => go(item.page)}
          aria-label={item.label}
        >
          <span className="bottom-nav-icon">
            {item.image ? (
              <img src={item.image} alt={item.label} className="bottom-nav-image" />
            ) : (
              <Icon name={item.icon!} size={20} />
            )}
          </span>
          <span className="bottom-nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function SectionHead({
  eyebrow,
  title,
  action,
  onAction,
}: {
  eyebrow?: string;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="section-head">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action && (
        <button className="text-link" onClick={onAction}>
          {action}
          <Icon name="arrow" />
        </button>
      )}
    </div>
  );
}

function Home({
  go,
  selectProduct,
}: {
  go: (p: Page) => void;
  selectProduct: (p: Product) => void;
}) {
  const { products } = useCatalog();
  const categories = Array.from(
    new Set(products.map((product) => product.category)),
  );
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow light">NEW SEASON / 2026</span>
          <h1>
            WEAR <em>YOU</em>
            <br />
            BE <em>YOU.</em>
          </h1>
          <p>Streetwear born in Accra. Built for people who move different.</p>
          <div className="button-row">
            <Button variant="lime" onClick={() => go("shop")}>
              Shop now <Icon name="arrow" />
            </Button>
            <Button variant="outline" onClick={() => go("explore")}>
              Explore designs
            </Button>
          </div>
        </div>
        <div className="hero-image">
          <img src={photos.hero} alt="Two models wearing black streetwear" />
          <div className="image-stamp">
            ACCRA
            <br />
            GHANA
          </div>
        </div>
        <div className="hero-index">01 / 04</div>
      </section>

      <section className="section">
        <SectionHead
          eyebrow="SHOP BY STYLE"
          title="Find your rotation."
          action="View all"
          onAction={() => go("shop")}
        />
        <div className="category-grid">
          {categories.map((name, i) => (
            <button
              key={name}
              className={`category-card c${i}`}
              onClick={() => go("shop")}
            >
              <span>0{i + 1}</span>
              <strong>{name}</strong>
              <Icon name="arrow" />
            </button>
          ))}
        </div>
      </section>

      <section className="section products-section">
        <SectionHead
          eyebrow="THE LATEST"
          title="Fresh on the streets."
          action="Shop all"
          onAction={() => go("shop")}
        />
        <div className="product-row">
          {products.slice(0, 4).map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onClick={() => selectProduct(product)}
            />
          ))}
        </div>
      </section>

      <section className="manifesto">
        <span>DESIGNED IN GHANA</span>
        <h2>
          NOT JUST WHAT
          <br />
          YOU WEAR.{" "}
          <em>
            WHO
            <br />
            YOU ARE.
          </em>
        </h2>
        <Button variant="lime" onClick={() => go("explore")}>
          See our designs <Icon name="arrow" />
        </Button>
      </section>
    </>
  );
}

function ProductCard({
  product,
  onClick,
  add,
}: {
  product: Product;
  onClick: () => void;
  add?: () => void;
}) {
  return (
    <article className="product-card">
      <button className="product-image" onClick={onClick}>
        <img src={product.images[0] || ""} alt={product.name} />
        <span className={`stock ${product.stock === "Low stock" ? "low" : ""}`}>
          {product.stock}
        </span>
      </button>
      <button className="product-info" onClick={onClick}>
        <h3>{product.name}</h3>
        <span>{product.category}</span>
        <strong>GHS {product.price.toLocaleString()}</strong>
      </button>
      {add && (
        <Button onClick={add}>
          Add to cart <Icon name="plus" />
        </Button>
      )}
    </article>
  );
}

function Shop({
  selectProduct,
  add,
}: {
  selectProduct: (p: Product) => void;
  add: (product: Product) => void;
}) {
  const { products } = useCatalog();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All items");
  const [sort, setSort] = useState<"newest" | "price-low" | "price-high">(
    "newest",
  );
  const [isSortOpen, setIsSortOpen] = useState(false);

  // Close sort menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (isSortOpen && !e.composedPath().includes(document.querySelector(".result-bar")!)) {
        setIsSortOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSortOpen]);
  const [shuffled, setShuffled] = useState<Product[]>([]);
  const categories = [
    "All items",
    ...Array.from(new Set(products.map((p) => p.category))),
  ];

  // Shuffle products whenever the catalogue (re)loads — refresh / new open
  useEffect(() => {
    if (products.length === 0) return;
    const copy = [...products];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    setShuffled(copy);
  }, [products]);

  const source = shuffled.length > 0 ? shuffled : products;

  const filtered = source
    .filter(
      (p) =>
        (category === "All items" || p.category === category) &&
        (p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.category.toLowerCase().includes(query.toLowerCase())),
    )
    .sort((a, b) => {
      if (sort === "price-low") return a.price - b.price;
      if (sort === "price-high") return b.price - a.price;
      return 0;
    });

  return (
    <div className="page shop-page">
      {/*<div className="page-title">
        <span className="eyebrow">SHOP / ALL PRODUCTS</span>
        <h1>Wear the wise.</h1>
        <p>Curated essentials. Limited runs. Made to stand out.</p>
      </div> */}
      <div className="shop-layout">
        <aside className="filters">
          <div className="filter-search">
            <Icon name="search" />
            <input
              aria-label="Search products"
              placeholder="Search products"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Filter title="Categories">
            {categories.map((x) => (
              <label className="check" key={x}>
                <input
                  type="radio"
                  name="shop-category"
                  checked={category === x}
                  onChange={() => setCategory(x)}
                />
                <span>{x}</span>
              </label>
            ))}
          </Filter>
        </aside>
        <section className="shop-results">
          <div className="result-bar">
            <button
              className="sort-btn"
              onClick={(e) => {
                e.stopPropagation();
                setIsSortOpen(!isSortOpen);
              }}
              aria-label="Sort products"
            >
              <img src="/sort.png" alt="Sort" className="sort-icon" />
              <span>{sort === "newest" ? "Newest first" : sort === "price-low" ? "Lowest price first" : "Highest price first"}</span>
              <Icon name="arrow" size={14} />
            </button>
            {isSortOpen && (
              <div className="sort-menu">
                <button
                  className={`sort-option${sort === "newest" ? " active" : ""}`}
                  onClick={() => { setSort("newest"); setIsSortOpen(false); }}
                >
                  Newest first
                </button>
                <button
                  className={`sort-option${sort === "price-low" ? " active" : ""}`}
                  onClick={() => { setSort("price-low"); setIsSortOpen(false); }}
                >
                  Lowest price first
                </button>
                <button
                  className={`sort-option${sort === "price-high" ? " active" : ""}`}
                  onClick={() => { setSort("price-high"); setIsSortOpen(false); }}
                >
                  Highest price first
                </button>
              </div>
            )}
          </div>
          <div className="product-grid">
            {filtered.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onClick={() => selectProduct(p)}
                add={() => add(p)}
              />
            ))}
            {filtered.length === 0 && (
              <p>No available products match this search.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Filter({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="filter">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function ProductDetail({
  product,
  add,
  go,
  selectProduct,
}: {
  product: Product;
  add: (quantity: number, size: string, color: string) => void;
  go: (p: Page) => void;
  selectProduct: (p: Product) => void;
}) {
  const { products } = useCatalog();
  const [qty, setQty] = useState(1);
  const [size, setSize] = useState(product.sizeOptions[0] ?? "");
  const [color, setColor] = useState(product.colorOptions[0] ?? "");
  const [activeImage, setActiveImage] = useState(0);
  return (
    <div className="page">
      <button className="back-link" onClick={() => go("shop")}>
        ← Back to shop
      </button>
      <div className="detail-layout">
        <div className="gallery">
          <div className="thumbs">
            {product.images.map((img, i) => (
              <button
                key={i}
                className={activeImage === i ? "active" : ""}
                onClick={() => setActiveImage(i)}
              >
                <img src={img} alt="" />
              </button>
            ))}
          </div>
          <div className="main-image">
            <img src={product.images[activeImage] || ""} alt={product.name} />
          </div>
        </div>
        <div className="detail-copy">
          <span className="eyebrow">{product.category}</span>
          <h1>{product.name}</h1>
          <div className="detail-price">
            GHS {product.price.toLocaleString()}
          </div>
          <div className="stock-line">
            <span className="status-dot" /> {product.stock}{" "}
            <small>• Deliver within 1–2 days</small>
          </div>
          {product.sizeOptions.length > 0 && (
            <Option title="Select size">
              <div className="pill-row">
                {product.sizeOptions.map((x) => (
                  <button
                    className={size === x ? "selected" : ""}
                    onClick={() => setSize(x)}
                    key={x}
                  >
                    {x}
                  </button>
                ))}
              </div>
            </Option>
          )}
          {product.colorOptions.length > 0 && (
            <Option title="Colour">
              <div className="pill-row">
                {product.colorOptions.map((x) => (
                  <button
                    className={color === x ? "selected" : ""}
                    key={x}
                    onClick={() => setColor(x)}
                  >
                    {x}
                  </button>
                ))}
              </div>
            </Option>
          )}
          <div className="buy-row">
            <div className="qty">
              <button onClick={() => setQty(Math.max(1, qty - 1))}>
                <Icon name="minus" />
              </button>
              <span>{qty}</span>
              <button onClick={() => setQty(Math.min(20, qty + 1))}>
                <Icon name="plus" />
              </button>
            </div>
            <Button onClick={() => add(qty, size, color)} className="grow">
              Add to cart — GHS {(product.price * qty).toLocaleString()}
            </Button>
          </div>
          <Button variant="outline" className="wide">
            <Icon name="whatsapp" /> WhatsApp enquiry
          </Button>
          <div className="description">
            <h3>Details</h3>
            <p>
              {product.description ||
                "Designed in Accra for everyday rotation."}
            </p>
          </div>
        </div>
      </div>
      <section className="related">
        <SectionHead title="You may also like." />
        <div className="product-row">
          {products
            .filter((x) => x.id !== product.id)
            .slice(0, 3)
            .map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onClick={() => {
                  selectProduct(p);
                  window.scrollTo(0, 0);
                }}
              />
            ))}
        </div>
      </section>
    </div>
  );
}

function Option({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="option">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function Cart({
  go,
  product,
  count,
  setCount,
  clearCart,
  discount,
  onDiscountApplied,
}: {
  go: (p: Page) => void;
  product: Product | null;
  count: number;
  setCount: (count: number) => void;
  clearCart: () => void;
  discount: AppliedDiscount | null;
  onDiscountApplied: (discount: AppliedDiscount | null) => void;
}) {
  const items = product && count > 0 ? [product] : [];
  const subtotal = product ? product.price * count : 0;
  const [code, setCode] = useState(discount?.code ?? "");
  const [discountError, setDiscountError] = useState("");
  const [applying, setApplying] = useState(false);
  async function applyDiscount() {
    setDiscountError("");
    setApplying(true);
    const { data, error } = await supabase.rpc("preview_store_discount", {
      p_code: code,
      p_subtotal: subtotal,
    });
    if (error || !data) {
      onDiscountApplied(null);
      setDiscountError(
        error?.message ?? "This discount code is not currently valid.",
      );
    } else {
      onDiscountApplied(data as AppliedDiscount);
    }
    setApplying(false);
  }
  const discountAmount = Number(discount?.amount ?? 0);
  return (
    <div className="page narrow">
      <div className="page-title left">
        <span className="eyebrow">YOUR BAG</span>
        <h1>
          Cart <sup>{count}</sup>
        </h1>
      </div>
      <div className="cart-layout">
        <div className="cart-list">
          {items.map((p) => (
            <div className="cart-item" key={p.id}>
              <img src={p.images[0] || ""} alt={p.name} />
              <div className="cart-item-copy">
                <span>{p.category}</span>
                <h3>{p.name}</h3>
                <p>Choose options at checkout</p>
                <div className="qty small">
                  <button onClick={() => setCount(Math.max(1, count - 1))}>
                    <Icon name="minus" />
                  </button>
                  <span>{count}</span>
                  <button onClick={() => setCount(Math.min(20, count + 1))}>
                    <Icon name="plus" />
                  </button>
                </div>
              </div>
              <strong>GHS {(p.price * count).toLocaleString()}</strong>
            </div>
          ))}
          {items.length === 0 && <p>Your cart is empty.</p>}
          {items.length > 0 && (
            <Button
              variant="outline"
              onClick={clearCart}
              className="clear-cart-btn"
            >
              <Icon name="close" size={14} /> Clear Cart
            </Button>
          )}
        </div>
        <aside className="summary">
          <h2>Order summary</h2>
          <SummaryLine
            label="Subtotal"
            value={`GHS ${subtotal.toLocaleString()}`}
          />
          <SummaryLine label="Delivery" value="Calculated at checkout" />
          <div className="discount">
            <Field
              label="Discount code"
              placeholder="Enter code"
              value={code}
              onChange={setCode}
            />
            <Button variant="outline" onClick={() => void applyDiscount()}>
              {applying ? "Checking…" : "Apply"}
            </Button>
          </div>
          {discount && (
            <SummaryLine
              label={`Discount (${discount.code})`}
              value={`− GHS ${discountAmount.toLocaleString()}`}
            />
          )}
          {discountError && (
            <small className="checkout-error">{discountError}</small>
          )}
          <div className="total">
            <span>Total</span>
            <strong>
              GHS {Math.max(0, subtotal - discountAmount).toLocaleString()}
            </strong>
          </div>
          <Button
            variant="lime"
            className="wide"
            onClick={() => go("checkout")}
          >
            Checkout securely <Icon name="arrow" />
          </Button>
          <small>Secure checkout powered by Paystack</small>
        </aside>
      </div>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Checkout({
  go,
  product,
  count,
  size,
  color,
  discount,
}: {
  go: (p: Page) => void;
  product: Product | null;
  count: number;
  size: string;
  color: string;
  discount: AppliedDiscount | null;
}) {
  const [step, setStep] = useState(1);
  const [settings, setSettings] = useState<{
    courier_fee: number | string | null;
    other_fee: number | string | null;
    free_delivery_areas: string[];
  } | null>(null);
  const [areas, setAreas] = useState<
    {
      id: string;
      region: string;
      area: string;
      fee: number | string;
      free_delivery: boolean;
    }[]
  >([]);
  const [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [email, setEmail] = useState("");
  const [method, setMethod] = useState<"courier" | "other">("courier");
  const [region, setRegion] = useState(""),
    [areaId, setAreaId] = useState(""),
    [areaText, setAreaText] = useState(""),
    [address, setAddress] = useState(""),
    [instructions, setInstructions] = useState("");
  const [working, setWorking] = useState(false),
    [error, setError] = useState(""),
    [orderCode, setOrderCode] = useState("");
  const subtotal = product ? product.price * count : 0;
  useEffect(() => {
    let alive = true;
    void Promise.all([
      supabase
        .from("store_delivery_settings")
        .select("courier_fee,other_fee,free_delivery_areas")
        .eq("singleton", true)
        .maybeSingle(),
      supabase
        .from("delivery_areas")
        .select("id,region,area,fee,free_delivery")
        .eq("status", "active")
        .order("region")
        .order("area"),
    ]).then(([s, a]) => {
      if (!alive) return;
      if (s.error)
        setError(`Could not load delivery prices: ${s.error.message}`);
      else setSettings(s.data);
      if (a.error)
        setError(`Could not load delivery areas: ${a.error.message}`);
      else {
        const rows = a.data ?? [];
        setAreas(rows);
        setRegion(rows[0]?.region ?? "");
      }
    });
    return () => {
      alive = false;
    };
  }, []);
  const regions = Array.from(new Set(areas.map((a) => a.region)));
  const area = areas.find((a) => a.id === areaId) ?? null;
  const legacyFree = Boolean(
    areaText.trim() &&
    settings?.free_delivery_areas?.some(
      (a) => a.trim().toLowerCase() === areaText.trim().toLowerCase(),
    ),
  );
  const deliveryFee = useMemo(() => {
    if (area?.free_delivery || legacyFree) return 0;
    if (!settings) return null;
    if ((method === "courier" || method === "other") && area)
      return Number(area.fee);
    const raw =
      method === "courier" ? settings.courier_fee : settings.other_fee;
    return raw == null ? null : Number(raw);
  }, [area, legacyFree, method, settings]);
  const discountAmount = Number(discount?.amount ?? 0);
  const total = Math.max(0, subtotal + (deliveryFee ?? 0) - discountAmount);
  const chosenArea = area?.area ?? areaText.trim();
  async function pay() {
    setError("");
    if (!product || count < 1) {
      setError("Your cart is empty.");
      return;
    }
    if (!name.trim() || phone.replace(/\D/g, "").length < 7) {
      setStep(1);
      setError("Enter your name and a valid phone number.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setStep(1);
      setError("Enter a valid email for your Paystack receipt.");
      return;
    }
    if (
      (method === "courier" || method === "other") &&
      (!chosenArea || !address.trim())
    ) {
      setStep(2);
      setError("Choose a delivery area and enter your delivery address.");
      return;
    }
    if (
      (method === "courier" || method === "other") &&
      areas.length > 0 &&
      !area
    ) {
      setStep(2);
      setError("Choose one of the active delivery areas.");
      return;
    }
    if (deliveryFee === null) {
      setStep(2);
      setError(
        "This delivery method is not currently available. Contact WearWise for help.",
      );
      return;
    }
    setWorking(true);
    try {
      if (!orderCode) {
        const response = await fetch(
          `${publicSupabaseUrl}/functions/v1/create-store-order`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: publicSupabaseAnonKey,
              Authorization: `Bearer ${publicSupabaseAnonKey}`,
            },
            body: JSON.stringify({
              itemId: product.id,
              quantity: count,
              size,
              color,
              discountCode: discount?.code ?? "",
              customer: { name, phone, email },
              delivery: {
                method,
                region,
                area: chosenArea,
                address,
                instructions,
              },
            }),
          },
        );
        const data = await response.json();
        if (!response.ok || !data.order_code)
          throw new Error(data.error ?? "Could not save the order.");
        setOrderCode(data.order_code);
        await startPayment(data.order_code);
      } else await startPayment(orderCode);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Checkout could not start. Please try again.",
      );
    }
    setWorking(false);
  }
  async function startPayment(code: string) {
    const response = await fetch(
      `${publicSupabaseUrl}/functions/v1/initialize-payment`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: publicSupabaseAnonKey,
          Authorization: `Bearer ${publicSupabaseAnonKey}`,
        },
        body: JSON.stringify({ orderCode: code, phone, email }),
      },
    );
    const data = await response.json();
    if (!response.ok || !data.authorizationUrl)
      throw new Error(
        `${data.error ?? "Could not start payment."} Your order code is ${code}.`,
      );
    window.location.assign(data.authorizationUrl);
  }
  return (
    <div className="checkout-page">
      <div className="checkout-main">
        <button className="logo checkout-logo" onClick={() => go("home")}>
          WEAR<span>WISE</span>
        </button>
        <div className="steps">
          {["Contact", "Delivery", "Payment"].map((x, i) => (
            <div className={step >= i + 1 ? "step active" : "step"} key={x}>
              <span>
                {step > i + 1 ? <Icon name="check" size={14} /> : i + 1}
              </span>
              <strong>{x}</strong>
            </div>
          ))}
        </div>
        {step === 1 && (
          <div className="form-panel">
            <h1>How can we reach you?</h1>
            <p>We’ll only use this to keep you updated on your order.</p>
            <Field
              label="Full name"
              placeholder="e.g. Kwame Mensah"
              value={name}
              onChange={setName}
            />
            <Field
              label="Phone number"
              placeholder="024 000 0000"
              type="tel"
              value={phone}
              onChange={setPhone}
            />
            <Field
              label="Email for your receipt"
              placeholder="you@example.com"
              type="email"
              value={email}
              onChange={setEmail}
            />
            <Button
              className="wide"
              onClick={() => {
                if (
                  !name.trim() ||
                  phone.replace(/\D/g, "").length < 7 ||
                  !email.trim()
                ) {
                  setError("Enter your name, valid phone number, and email.");
                  return;
                }
                setError("");
                setStep(2);
              }}
            >
              Continue to delivery <Icon name="arrow" />
            </Button>
          </div>
        )}
        {step === 2 && (
          <div className="form-panel">
            <button className="back-link" onClick={() => setStep(1)}>
              ← Back
            </button>
            <h1>Where should we deliver?</h1>
            <p>Delivery fees are managed by WearWise and updated here live.</p>
            {areas.length > 0 ? (
              <>
                <label className="field">
                  <span>Region</span>
                  <select
                    value={region}
                    onChange={(e) => {
                      setRegion(e.target.value);
                      setAreaId("");
                    }}
                  >
                    {regions.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Area</span>
                  <select
                    value={areaId}
                    onChange={(e) => setAreaId(e.target.value)}
                  >
                    <option value="">Choose an area</option>
                    {areas
                      .filter((a) => a.region === region)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.area}
                          {a.free_delivery
                            ? " · Free delivery"
                            : ` · GHS ${Number(a.fee).toFixed(2)}`}
                        </option>
                      ))}
                  </select>
                </label>
              </>
            ) : (
              <Field
                label="Delivery area"
                placeholder="Area or campus"
                value={areaText}
                onChange={setAreaText}
              />
            )}
            <div className="delivery-methods">
              {(
                [
                  ["courier", "Courier delivery"],
                  ["other", "Other"],
                ] as const
              ).map(([v, label]) => {
                const fee =
                  area?.free_delivery || legacyFree
                    ? 0
                    : v === "courier" || v === "other"
                      ? area
                        ? Number(area.fee)
                        : settings?.[
                            v === "courier" ? "courier_fee" : "other_fee"
                          ]
                      : v === "courier"
                        ? settings?.courier_fee
                        : settings?.other_fee;
                const disabled = fee == null;
                return (
                  <button
                    type="button"
                    disabled={disabled}
                    className={method === v ? "selected" : ""}
                    onClick={() => setMethod(v)}
                    key={v}
                  >
                    <span>{label}</span>
                    <b>
                      {disabled
                        ? "Unavailable"
                        : `GHS ${Number(fee).toFixed(2)}`}
                    </b>
                  </button>
                );
              })}
            </div>
            {method === "courier" || method === "other" ? (
              <Field
                label="Delivery address / landmark"
                placeholder="House, street, Ghana Post GPS"
                value={address}
                onChange={setAddress}
              />
            ) : null}
            <Field
              label="Delivery instructions (optional)"
              placeholder="Anything the delivery person should know"
              value={instructions}
              onChange={setInstructions}
            />
            <div className="total">
              <span>Delivery fee</span>
              <strong>
                {deliveryFee === null
                  ? "Choose a method"
                  : `GHS ${deliveryFee.toFixed(2)}`}
              </strong>
            </div>
            <Button
              className="wide"
              onClick={() => {
                if (
                  (method === "courier" || method === "other") &&
                  areas.length &&
                  !area
                ) {
                  setError("Choose an area first.");
                  return;
                }
                setError("");
                setStep(3);
              }}
            >
              Review & pay <Icon name="arrow" />
            </Button>
          </div>
        )}
        {step === 3 && (
          <div className="form-panel">
            <button className="back-link" onClick={() => setStep(2)}>
              ← Back
            </button>
            <h1>Ready when you are.</h1>
            <p>Review your order before making payment.</p>
            {product && count > 0 ? (
              <div className="mini-order">
                <div>
                  <img src={product.images[0] || ""} alt="" />
                  <span>
                    <strong>{product.name}</strong>
                    <small>Quantity {count}</small>
                  </span>
                  <b>GHS {subtotal.toLocaleString()}</b>
                </div>
              </div>
            ) : (
              <p>Your cart is empty.</p>
            )}
            {discount && (
              <div className="summary-line">
                <span>Discount ({discount.code})</span>
                <strong>− GHS {discountAmount.toFixed(2)}</strong>
              </div>
            )}
            <div className="summary-line">
              <span>Delivery</span>
              <strong>GHS {Number(deliveryFee ?? 0).toFixed(2)}</strong>
            </div>
            <div className="total">
              <span>Total</span>
              <strong>GHS {total.toFixed(2)}</strong>
            </div>
            <p>
              Deliver to {name} · {chosenArea || "handoff"} ·{" "}
              {method.replaceAll("_", " ")}
            </p>
            {error && (
              <p className="checkout-error" role="alert">
                {error}
              </p>
            )}
            {orderCode && error && (
              <p>
                Your order code is <strong>{orderCode}</strong>. You can retry
                payment without creating another order.
              </p>
            )}
            <Button variant="pay" className="wide" onClick={() => void pay()}>
              {working
                ? "Opening secure payment…"
                : orderCode
                  ? "Retry secure payment"
                  : "Pay securely with Paystack"}{" "}
              <Icon name="arrow" />
            </Button>
          </div>
        )}
      </div>
      <aside className="checkout-aside">
        <div>
          <span className="eyebrow light">WEARWISE PROMISE</span>
          <h2>
            Streetwear,
            <br />
            without the stress.
          </h2>
        </div>
        <ul>
          <li>
            <Icon name="check" /> Secure Ghanaian payments
          </li>
          <li>
            <Icon name="check" /> Fast delivery nationwide
          </li>
          <li>
            <Icon name="check" /> WhatsApp order updates
          </li>
        </ul>
      </aside>
    </div>
  );
}

function Success({
  code,
  message,
  primary,
  onPrimary,
  onSecondary,
}: {
  code: string;
  message: string;
  primary: string;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  return (
    <div className="success-page">
      <div className="confetti">
        {Array.from({ length: 18 }).map((_, i) => (
          <i key={i} />
        ))}
      </div>
      <div className="success-check">
        <Icon name="check" size={36} />
      </div>
      <span className="eyebrow">ALL DONE</span>
      <h1>Nice one!</h1>
      <p>{message}</p>
      <div className="code-box">
        <small>YOUR CODE</small>
        <strong>{code}</strong>
        <button onClick={() => navigator.clipboard?.writeText(code)}>
          <Icon name="copy" /> Copy
        </button>
      </div>
      <div className="button-row center">
        <Button onClick={onPrimary}>{primary}</Button>
        <Button variant="outline" onClick={onSecondary}>
          Continue shopping
        </Button>
      </div>
    </div>
  );
}

function PaymentReturn({ go }: { go: (p: Page) => void }) {
  const params = new URLSearchParams(window.location.search),
    reference = params.get("reference") || params.get("trxref") || "",
    orderCode = params.get("orderCode") || "";
  const [state, setState] = useState<
    "checking" | "paid" | "failed" | "pending" | "error"
  >("checking");
  const [message, setMessage] = useState(
    "Checking your payment securely with Paystack…",
  );
  useEffect(() => {
    let active = true;
    async function verify() {
      if (!reference) {
        setState("error");
        setMessage(
          "We could not find a payment reference. Contact WearWise with your order code if you completed payment.",
        );
        return;
      }
      try {
        const response = await fetch(
          `${publicSupabaseUrl}/functions/v1/verify-payment`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: publicSupabaseAnonKey,
              Authorization: `Bearer ${publicSupabaseAnonKey}`,
            },
            body: JSON.stringify({ reference }),
          },
        );
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.error ?? "Payment verification is unavailable.",
          );
        if (active) {
          setState(
            result.status === "paid"
              ? "paid"
              : result.status === "failed"
                ? "failed"
                : "pending",
          );
          setMessage(
            result.status === "paid"
              ? "Your payment is confirmed. WearWise can now begin preparing your order."
              : result.status === "failed"
                ? "The payment was not completed. You can try again using your order code."
                : "Paystack has not confirmed the payment yet. If your account was charged, contact WearWise with this code.",
          );
        }
      } catch (cause) {
        if (active) {
          setState("error");
          setMessage(
            cause instanceof Error
              ? cause.message
              : "We could not verify your payment yet.",
          );
        }
      }
    }
    void verify();
    return () => {
      active = false;
    };
  }, [reference]);
  return (
    <div className="payment-return">
      <div className="payment-return-card">
        <span className="eyebrow">
          {state === "paid"
            ? "PAYMENT CONFIRMED"
            : state === "checking"
              ? "PLEASE WAIT"
              : "PAYMENT UPDATE"}
        </span>
        <h1>
          {state === "paid"
            ? "Thank you!"
            : state === "checking"
              ? "Verifying payment"
              : state === "pending"
                ? "Still confirming"
                : "Payment update"}
        </h1>
        <p>{message}</p>
        {orderCode && (
          <div className="code-box">
            <small>YOUR ORDER CODE</small>
            <strong>{orderCode}</strong>
            <button onClick={() => navigator.clipboard?.writeText(orderCode)}>
              <Icon name="copy" /> Copy
            </button>
          </div>
        )}
        {reference && (
          <small className="payment-reference">
            Payment reference · {reference}
          </small>
        )}
        <div className="button-row">
          <Button onClick={() => go("track")}>Track order</Button>
          <Button variant="outline" onClick={() => go("home")}>
            Continue shopping
          </Button>
        </div>
      </div>
    </div>
  );
}

function Explore({ selectDesign }: { selectDesign: (d: Design) => void }) {
  const { designs } = useCatalog();
  const [tag, setTag] = useState("All");
  const [search, setSearch] = useState("");
  const shown = useMemo(
    () =>
      designs.filter(
        (d) =>
          (tag === "All" || d.tags.includes(tag)) &&
          d.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [tag, search],
  );
  return (
    <div className="page explore-page">
      <div className="explore-title">
        <span className="eyebrow">WEARWISE DESIGN ARCHIVE</span>
        <h1>
          Pick the art.
          <br />
          <em>Make it yours.</em>
        </h1>
        <p>
          Original graphics ready to print on your favourite fit. No prices here
          — tell us what you want and we’ll quote it.
        </p>
      </div>
      <div className="explore-tools">
        <Filter title="Categories">
          {["All", "Anime", "Ghana", "Street", "Type", "Minimal"].map((x) => (
            <label className="check" key={x}>
              <input
                type="radio"
                name="explore-category"
                checked={tag === x}
                onChange={() => setTag(x)}
              />
              <span>{x}</span>
            </label>
          ))}
        </Filter>
        <div className="filter-search">
          <Icon name="search" />
          <input
            aria-label="Search designs"
            placeholder="Search designs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="masonry">
        {shown.map((d, i) => (
          <article className={`design-card d${i % 3}`} key={d.code}>
            <button className="design-image" onClick={() => selectDesign(d)}>
              <img src={d.image} alt={d.name} />
              <span className="request-hover">
                View design <Icon name="arrow" />
              </span>
            </button>
            <div>
              <small>{d.code}</small>
              <h3>{d.name}</h3>
              <p>{d.tags.map((x) => `#${x}`).join(" ")}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function DesignDetail({
  design,
  go,
}: {
  design: Design;
  go: (p: Page) => void;
}) {
  return (
    <div className="page">
      <button className="back-link" onClick={() => go("explore")}>
        ← Back to designs
      </button>
      <div className="design-detail">
        <div className="design-hero-img">
          <img src={design.image} alt={design.name} />
          <span>PRINT PREVIEW</span>
        </div>
        <div className="design-copy">
          <span className="eyebrow">{design.code}</span>
          <h1>{design.name}</h1>
          <div className="tag-row">
            {design.tags.map((x) => (
              <span key={x}>#{x}</span>
            ))}
          </div>
          <p>
            Choose this original WEARWISE graphic, then customise the shirt,
            colour and fit. We’ll confirm availability and send your personal
            quote on WhatsApp.
          </p>
          <Option title="Available print colours">
            <div className="color-row">
              <button className="color black selected" />
              <button className="color cream" />
              <button className="color green" />
              <button className="color red" />
            </div>
          </Option>
          <Button
            variant="lime"
            className="wide big"
            onClick={() => go("request")}
          >
            Request this design <Icon name="arrow" />
          </Button>
          <small>No payment required to request.</small>
        </div>
      </div>
      <section className="how">
        <SectionHead eyebrow="SIMPLE PROCESS" title="How it works." />
        <div className="how-grid">
          {[
            "Request your fit",
            "We quote on WhatsApp",
            "Pay through secure link",
            "We print & deliver",
          ].map((x, i) => (
            <div key={x}>
              <span>0{i + 1}</span>
              <h3>{x}</h3>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function RequestForm({
  design,
  go,
}: {
  design: Design | null;
  go: (p: Page) => void;
}) {
  const [products, setProducts] = useState<
    {
      id: string;
      name: string;
      category: string;
      usual_sizes: string[];
      usual_colors: string[];
    }[]
  >([]);
  const [productId, setProductId] = useState(""),
    [size, setSize] = useState(""),
    [color, setColor] = useState(""),
    [quantity, setQuantity] = useState("1");
  const [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [email, setEmail] = useState(""),
    [area, setArea] = useState(""),
    [address, setAddress] = useState(""),
    [method, setMethod] = useState("courier"),
    [notes, setNotes] = useState(""),
    [artwork, setArtwork] = useState<File | null>(null);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [orderCode, setOrderCode] = useState("");
  useEffect(() => {
    let alive = true;
    void supabase
      .from("products")
      .select("id,name,category,usual_sizes,usual_colors")
      .eq("is_active", true)
      .eq("category", "T-shirts")
      .order("created_at")
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setError(`Could not load shirt options: ${error.message}`);
        const rows = (data ?? []) as typeof products;
        setProducts(rows);
        setProductId(rows[0]?.id ?? "");
        setSize(rows[0]?.usual_sizes?.[0] ?? "");
        setColor(rows[0]?.usual_colors?.[0] ?? "");
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  const chosen = products.find((p) => p.id === productId);
  async function submit() {
    setError("");
    if (!chosen) {
      setError(
        "There are no active T-shirt options. Contact WearWise for help.",
      );
      return;
    }
    if (!name.trim() || phone.replace(/\D/g, "").length < 7) {
      setError("Enter your name and a valid WhatsApp number.");
      return;
    }
    if (!size || !color) {
      setError("Choose a size and colour.");
      return;
    }
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
      setError("Choose a quantity from 1 to 20.");
      return;
    }
    setBusy(true);
    const form = new FormData();
    form.append(
      "payload",
      JSON.stringify({
        orderType: design ? "existing_design" : "custom_design",
        productId: chosen.id,
        ...(design ? { designId: design.id } : {}),
        size,
        color,
        quantity: qty,
        customerRequest: notes,
        rushDaysEarly: 0,
        customization: { printPlacement: "front", customText: "" },
        customer: { name, phone, email },
        delivery: { method, area, address, instructions: "" },
      }),
    );
    form.append("website", "");
    if (artwork) form.append("artwork", artwork, artwork.name);
    try {
      const response = await fetch(
        `${publicSupabaseUrl}/functions/v1/create-order`,
        {
          method: "POST",
          headers: {
            apikey: publicSupabaseAnonKey,
            Authorization: `Bearer ${publicSupabaseAnonKey}`,
          },
          body: form,
        },
      );
      const result = await response.json();
      if (!response.ok || !result.orderCode)
        throw new Error(
          result.error ?? "Could not submit your design request.",
        );
      setOrderCode(result.orderCode);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not connect to WearWise. Try again.",
      );
    }
    setBusy(false);
  }
  if (orderCode)
    return (
      <div className="success-page">
        <div className="success-check">
          <Icon name="check" size={36} />
        </div>
        <span className="eyebrow">REQUEST RECEIVED</span>
        <h1>Thanks, {name.split(" ")[0]}.</h1>
        <p>
          We’ll confirm that we can make your requested design, size and colour,
          then send you the price. Payment is requested only after availability
          and price are confirmed.
        </p>
        <div className="code-box">
          <small>YOUR REQUEST CODE</small>
          <strong>{orderCode}</strong>
          <button onClick={() => navigator.clipboard?.writeText(orderCode)}>
            <Icon name="copy" /> Copy
          </button>
        </div>
        <div className="button-row center">
          <Button onClick={() => go("track")}>Track request</Button>
          <Button variant="outline" onClick={() => go("home")}>
            Back to WearWise
          </Button>
        </div>
      </div>
    );
  return (
    <div className="request-page">
      <div className="request-preview">
        <button
          className="back-link light"
          onClick={() => go(design ? "design" : "home")}
        >
          ← Back
        </button>
        {design ? (
          <>
            <img src={design.image} alt={design.name} />
            <div>
              <span>{design.code}</span>
              <h2>{design.name}</h2>
            </div>
          </>
        ) : (
          <div className="request-custom-preview">
            <span>WEARWISE / CUSTOM</span>
            <h2>Bring your own idea.</h2>
            <p>Describe the design you want or upload a reference image.</p>
          </div>
        )}
      </div>
      <div className="request-form">
        <span className="eyebrow">
          {design ? "CUSTOM REQUEST" : "REQUEST A CUSTOM DESIGN"}
        </span>
        <h1>{design ? "Build your fit." : "Request a custom design."}</h1>
        <p>
          {design ? (
            <>
              Request Design <strong>{design.code}</strong>. We’ll confirm
              availability and price before payment.
            </>
          ) : (
            "Tell us what you want printed and we’ll confirm availability and price before payment."
          )}
        </p>
        {loading ? (
          <div className="page-loading">
            <div className="spinner" />
          </div>
        ) : (
          <>
            <div className="form-grid">
              <label className="field">
                <span>Shirt type</span>
                <select
                  value={productId}
                  onChange={(e) => {
                    const p = products.find((x) => x.id === e.target.value);
                    setProductId(e.target.value);
                    setSize(p?.usual_sizes?.[0] ?? "");
                    setColor(p?.usual_colors?.[0] ?? "");
                  }}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Size</span>
                <select value={size} onChange={(e) => setSize(e.target.value)}>
                  {(chosen?.usual_sizes ?? []).map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Colour</span>
                <select
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                >
                  {(chosen?.usual_colors ?? []).map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <Field
                label="Quantity"
                type="number"
                value={quantity}
                onChange={setQuantity}
              />
              <Field
                label="Full name"
                placeholder="Your name"
                value={name}
                onChange={setName}
              />
              <Field
                label="WhatsApp number 🇬🇭"
                placeholder="024 000 0000"
                value={phone}
                onChange={setPhone}
              />
              <Field
                label="Email (optional)"
                placeholder="you@example.com"
                type="email"
                value={email}
                onChange={setEmail}
              />
              <label className="field">
                <span>Delivery method</span>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  <option value="courier">Courier</option>
                  <option value="campus_handoff">Campus handoff</option>
                  <option value="sister_office_handoff">Office handoff</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <Field
                label="Region / area"
                placeholder="e.g. Greater Accra, Osu"
                value={area}
                onChange={setArea}
              />
              <Field
                label="Landmark / Ghana Post GPS"
                placeholder="Your delivery location"
                value={address}
                onChange={setAddress}
              />
            </div>
            <label className="field">
              <span>Upload artwork (optional · PNG, JPG, WebP · max 5 MB)</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (
                    f &&
                    (f.size > 5 * 1024 * 1024 ||
                      !["image/png", "image/jpeg", "image/webp"].includes(
                        f.type,
                      ))
                  ) {
                    setError("Choose PNG, JPG or WebP artwork under 5 MB.");
                    e.target.value = "";
                    return;
                  }
                  setError("");
                  setArtwork(f);
                }}
              />
            </label>
            {artwork && (
              <p>
                {artwork.name} · attach the file separately in WhatsApp if you
                need to explain special artwork changes.
              </p>
            )}
            <label className="field">
              <span>Notes</span>
              <textarea
                rows={4}
                placeholder="What would you like changed?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            {error && (
              <p className="checkout-error" role="alert">
                {error}
              </p>
            )}
            <Button
              variant="lime"
              className="wide"
              onClick={() => void submit()}
            >
              {busy ? "Submitting…" : "Submit design request"}{" "}
              <Icon name="arrow" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Track() {
  const [code, setCode] = useState(""),
    [lastFour, setLastFour] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    orderCode: string;
    status: string;
    paymentStatus: string;
    amount: number;
    currency: string;
    createdAt: string;
    estimatedDeliveryDate: string | null;
    history: { status: string; createdAt: string }[];
  } | null>(null);
  async function track() {
    setNotice("");
    setResult(null);
    setBusy(true);
    try {
      const response = await fetch(
        `${publicSupabaseUrl}/functions/v1/track-order`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: publicSupabaseAnonKey,
            Authorization: `Bearer ${publicSupabaseAnonKey}`,
          },
          body: JSON.stringify({ orderCode: code, lastFour }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "We could not find that order.");
      setResult(data);
    } catch (cause) {
      setNotice(
        cause instanceof Error
          ? cause.message
          : "Could not look up this order.",
      );
    }
    setBusy(false);
  }
  return (
    <div className="track-page">
      <div className="track-intro">
        <span className="eyebrow">ORDER LOOKUP</span>
        <h1>Where’s my fit?</h1>
        <p>
          Track a shop order or custom design request using the code we sent
          you.
        </p>
      </div>
      <div className="track-card">
        <div className="track-form">
          <Field
            label="Order or request code"
            placeholder="WW-… or WQ-…"
            value={code}
            onChange={setCode}
          />
          <Field
            label="Last 4 digits of phone"
            placeholder="e.g. 4821"
            value={lastFour}
            onChange={setLastFour}
          />
          <Button onClick={() => void track()}>
            {busy ? "Searching…" : "Track order"} <Icon name="arrow" />
          </Button>
        </div>
      </div>
      {notice && (
        <div role="alert" className="tracking-result">
          {notice}
        </div>
      )}
      {result && (
        <div className="tracking-result">
          <div className="tracking-head">
            <div>
              <span className="eyebrow">{result.orderCode}</span>
              <h2>{result.status.replaceAll("_", " ")}</h2>
            </div>
            <span className="a-status">
              {result.paymentStatus.replaceAll("_", " ")}
            </span>
          </div>
          <div className="track-details">
            <div>
              <span>ORDER TOTAL</span>
              <small>
                {result.currency} {result.amount.toFixed(2)}
              </small>
            </div>
            <div>
              <span>PLACED</span>
              <small>{new Date(result.createdAt).toLocaleString()}</small>
            </div>
            <div>
              <span>ESTIMATED DELIVERY</span>
              <small>
                {result.estimatedDeliveryDate
                  ? new Date(
                      `${result.estimatedDeliveryDate}T12:00:00`,
                    ).toLocaleDateString()
                  : "WearWise will confirm this"}
              </small>
            </div>
          </div>
          <div className="vertical-timeline">
            {result.history.map((entry, i) => (
              <div key={`${entry.status}-${entry.createdAt}`}>
                <i
                  className={i === result.history.length - 1 ? "current" : ""}
                />
                <span>
                  <strong>{entry.status.replaceAll("_", " ")}</strong>
                  <small>{new Date(entry.createdAt).toLocaleString()}</small>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Contact() {
  const socials = [
    {
      name: "Instagram",
      handle: "@wearwise_gh",
      href: "https://www.instagram.com/wearwise_gh?xtok=eWlnMmF1MmxyMmww",
      icon: "https://www.google.com/s2/favicons?domain=instagram.com&sz=64",
    },
    {
      name: "WhatsApp",
      handle: "026 992 2736",
      href: "https://wa.me/233269922736",
      icon: "https://www.google.com/s2/favicons?domain=whatsapp.com&sz=64",
    },
    {
      name: "TikTok",
      handle: "@wearwise_gh",
      href: "https://www.tiktok.com/@wearwise_gh?_r=1&_t=ZS-9AjHYiwer9o",
      icon: "https://www.google.com/s2/favicons?domain=tiktok.com&sz=64",
    },
    {
      name: "Snapchat",
      handle: "wearwise_gh",
      href: "https://www.snapchat.com/add/wearwise_gh?share_id=3qz7ya9e7OA&locale=en-GB",
      icon: "https://www.google.com/s2/favicons?domain=snapchat.com&sz=64",
    },
  ];
  return (
    <div className="page narrow contact-page">
      <div className="page-title left">
        <span className="eyebrow">CONTACT WEARWISE</span>
        <h1>Stay connected.</h1>
        <p>Follow the latest drops, designs, and order updates.</p>
      </div>
      <div className="contact-socials">
        {socials.map((social) => (
          <a
            className="contact-social"
            href={social.href}
            target="_blank"
            rel="noreferrer"
            key={social.name}
          >
            <img src={social.icon} alt="" />
            <span>
              <strong>{social.name}</strong>
              <small>{social.handle}</small>
            </span>
            <b>↗</b>
          </a>
        ))}
      </div>
    </div>
  );
}

function Footer({
  go,
  openCustomRequest,
}: {
  go: (p: Page) => void;
  openCustomRequest: () => void;
}) {
  return (
    <footer>
      <div className="footer-top">
        <div className="footer-identity">
          <button className="custom-request-link" onClick={openCustomRequest}>
            Request custom design
          </button>
          <div className="footer-brand">
            <button className="logo light" onClick={() => go("home")}>
              WEAR<span>WISE</span>
            </button>
            <p>
              Ghanaian streetwear for people
              <br />
              who know who they are.
            </p>
          </div>
        </div>
        <div className="footer-links">
          <div>
            <strong>SHOP</strong>
            <button onClick={() => go("shop")}>New arrivals</button>
            <button onClick={() => go("shop")}>All products</button>
            <button onClick={() => go("explore")}>Design archive</button>
          </div>
          <div>
            <strong>HELP</strong>
            <button onClick={() => go("track")}>Track order</button>
            <button onClick={() => go("contact")}>Contact us</button>
          </div>
          <div>
            <strong>CONNECT</strong>
            <a
              href="https://www.instagram.com/wearwise_gh?xtok=eWlnMmF1MmxyMmww"
              target="_blank"
              rel="noreferrer"
            >
              <img
                src="https://www.google.com/s2/favicons?domain=instagram.com&sz=32"
                alt=""
              />
              <span>Instagram</span>
            </a>
            <a
              href="https://wa.me/233269922736"
              target="_blank"
              rel="noreferrer"
            >
              <img
                src="https://www.google.com/s2/favicons?domain=whatsapp.com&sz=32"
                alt=""
              />
              <span>WhatsApp</span>
            </a>
            <a
              href="https://www.tiktok.com/@wearwise_gh?_r=1&_t=ZS-9AjHYiwer9o"
              target="_blank"
              rel="noreferrer"
            >
              <img
                src="https://www.google.com/s2/favicons?domain=tiktok.com&sz=32"
                alt=""
              />
              <span>TikTok</span>
            </a>
            <a
              href="https://www.snapchat.com/add/wearwise_gh?share_id=3qz7ya9e7OA&locale=en-GB"
              target="_blank"
              rel="noreferrer"
            >
              <img
                src="https://www.google.com/s2/favicons?domain=snapchat.com&sz=32"
                alt=""
              />
              <span>Snapchat</span>
            </a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 WEARWISE GHANA</span>
        <span>EVERYWHERE IN ACCRA</span>
      </div>
    </footer>
  );
}

export default App;
