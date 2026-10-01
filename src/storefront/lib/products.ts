import { apiGet } from '@/storefront/lib/api';
import { showableImages } from '@/storefront/lib/images';

export type Ingredient = {
  pct: string;
  name: string;
  short: string;
  long: string;
};

export type Product = {
  slug: string;
  variantId: string | null;
  name: string;
  subtitle: string;
  category: "lotion" | "set" | "soon";
  collections?: string[];
  price: number;
  compareAt?: number;
  size: string;
  images: string[];
  badge?: string;
  description: string;
  benefits: string[];
  available: boolean;
  comingSoon: boolean;
  inStock: boolean;
  contents?: string[];
};

export type ProductDetail = Product & {
  descriptionHtml: string | null;
  skinTypes: string[];
  ingredients: { name: string; pct: string; short: string }[];
  inci: string | null;
  howToUse: string | null;
  howToUseSteps: { title: string; text: string }[];
  story: { heading: string | null; body: string | null; image: string | null } | null;
  caution: string | null;
  storage: string | null;
  countryOfOrigin: string;
  variants: { id: string; title: string; price: number; size: string; available: boolean }[];
  related: Product[];
};

const withShowableImages = <T extends Product>(product: T): T => ({
  ...product,
  images: showableImages(product.images),
});

export type ShopCollection = { handle: string; title: string };

export const fetchCollections = () =>
  apiGet<ShopCollection[]>('/collections', { next: { revalidate: 300 } });

export async function fetchCollectionsSafely(): Promise<ShopCollection[]> {
  try {
    return await fetchCollections();
  } catch {
    return [];
  }
}

export const fetchProducts = async () =>
  (await apiGet<Product[]>('/products', { next: { revalidate: 300 } })).map(withShowableImages);

export async function fetchProduct(slug: string) {
  const product = await apiGet<ProductDetail>(`/products/${encodeURIComponent(slug)}`, {
    next: { revalidate: 300 },
  });
  return { ...withShowableImages(product), related: product.related.map(withShowableImages) };
}

export async function fetchProductsSafely(): Promise<Product[]> {
  try {
    return await fetchProducts();
  } catch {
    return [];
  }
}

export const fetchShopProducts = fetchProductsSafely;

export async function fetchProductOrNothing(slug: string) {
  try {
    return await fetchProduct(slug);
  } catch {
    return null;
  }
}

export const INGREDIENTS: Ingredient[] = [
  {
    pct: "6%",
    name: "Glycerin",
    short: "Deeply hydrates",
    long: "A humectant that pulls water into the upper layers of the skin and keeps it there, so skin stays plump and comfortable for hours after application.",
  },
  {
    pct: "3%",
    name: "Shea Butter",
    short: "Nourishes & softens",
    long: "Rich in fatty acids and vitamins, shea butter melts into dry patches, smoothing rough texture and leaving a soft, cushioned finish.",
  },
  {
    pct: "2%",
    name: "Coconut Oil",
    short: "Helps retain moisture",
    long: "A lightweight emollient that seals hydration in without a heavy, greasy film, so the lotion absorbs fast and stays breathable.",
  },
  {
    pct: "2%",
    name: "Niacinamide",
    short: "Supports even-looking skin",
    long: "Vitamin B3 supports a healthy skin barrier and a more even, refined look over time. Gentle enough for daily use on all skin types.",
  },
  {
    pct: "0.9%",
    name: "Triple Ceramide Complex",
    short: "Strengthens skin barrier",
    long: "Ceramide NP, AP and EOP replenish the skin's own lipids, reinforcing the moisture barrier that keeps water in and irritants out.",
  },
  {
    pct: "0.5%",
    name: "Vitamin E",
    short: "Antioxidant care",
    long: "Tocopherol protects skin lipids from everyday oxidative stress and adds a final layer of comfort to the formula.",
  },
];

export const INCI =
  "Aqua, Glycerin 6%, Cetearyl Alcohol, Cetyl Alcohol, Glyceryl Stearate SE, Ceteareth-20, C12-15 Alkyl Benzoate, Isododecane, Butyrospermum Parkii (Shea) Butter 3%, Niacinamide 2%, Cocos Nucifera (Coconut) Oil 2%, Palmitic Acid 1%, Stearic Acid 1%, Dimethicone (and) Dimethiconol, Carbomer, Tocopherol 0.5%, Ceramide NP 0.5%, Ceramide AP 0.2%, Ceramide EOP 0.2%, Phenoxyethanol, Sodium Benzoate, Disodium EDTA, Fragrance, Limonene, Citronellol, Linalool, Geraniol, Hexyl Cinnamal.";

export const HOW_TO_USE = [
  {
    title: "Apply",
    text: "Take a generous amount on clean, dry body skin. A little goes further than you think.",
  },
  {
    title: "Massage",
    text: "Work it in with slow, circular motions until fully absorbed. Non-greasy, so it's done in seconds.",
  },
  {
    title: "Repeat",
    text: "Best after a shower while skin is still slightly damp. Use morning and evening, or as needed.",
  },
];

export type ReviewTag = "Dry skin" | "Sensitive skin" | "Texture" | "Value";

export const REVIEW_TAGS: ReviewTag[] = ["Dry skin", "Sensitive skin", "Texture", "Value"];

export const REVIEWS: { name: string; city: string; text: string; tag: ReviewTag }[] = [
  { name: "Ananya R.", city: "Bengaluru", tag: "Texture", text: "Absorbs in seconds and my skin stays soft all day. The first lotion I've actually finished a bottle of." },
  { name: "Karan M.", city: "Mumbai", tag: "Texture", text: "Non-greasy is not a marketing line here. I put it on and get dressed straight away." },
  { name: "Sneha P.", city: "Pune", tag: "Dry skin", text: "My winter dryness is gone. The ceramides really do something, my skin feels calmer." },
  { name: "Ritika S.", city: "New Delhi", tag: "Value", text: "Smells subtle, feels expensive, priced honestly. The pump is a small luxury." },
  { name: "Arjun V.", city: "Hyderabad", tag: "Sensitive skin", text: "I have sensitive skin and this didn't sting once. Now on my third bottle." },
  { name: "Meera K.", city: "Chennai", tag: "Value", text: "The label tells you exactly what's inside and how much. That transparency won me over." },
  { name: "Devansh T.", city: "Jaipur", tag: "Dry skin", text: "Lightweight but somehow my elbows and knees are finally smooth. Great after a shower." },
  { name: "Priya N.", city: "Kolkata", tag: "Value", text: "Bought the Duo, one lives in my gym bag. It's become a habit, not a chore." },
];
