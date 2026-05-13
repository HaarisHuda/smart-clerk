import type { CatalogProduct, StoreData } from "./types";

const now = () => new Date().toISOString();

export const seedCatalog: CatalogProduct[] = [
  {
    id: "sku-nivia-tennis-ball",
    itemName: "Nivia Tennis Ball",
    category: "Balls",
    price: 400,
    stockQuantity: 24,
    aliases: ["tennis ball", "nivia ball", "green ball"],
    active: true,
    lowStockThreshold: 5,
    updatedAt: now(),
  },
  {
    id: "sku-yonex-nanoray-10f",
    itemName: "Yonex Nanoray 10F",
    category: "Badminton",
    price: 1950,
    stockQuantity: 6,
    aliases: ["yonex racket", "nanoray", "badminton racket"],
    active: true,
    lowStockThreshold: 3,
    updatedAt: now(),
  },
  {
    id: "sku-mrf-cricket-bat",
    itemName: "MRF Cricket Bat",
    category: "Cricket",
    price: 2850,
    stockQuantity: 2,
    aliases: ["mrf bat", "cricket bat", "bat"],
    active: true,
    lowStockThreshold: 3,
    updatedAt: now(),
  },
  {
    id: "sku-sg-cricket-ball",
    itemName: "SG Cricket Ball",
    category: "Cricket",
    price: 260,
    stockQuantity: 18,
    aliases: ["sg ball", "cricket ball", "leather ball"],
    active: true,
    lowStockThreshold: 6,
    updatedAt: now(),
  },
  {
    id: "sku-li-ning-shuttle",
    itemName: "Li-Ning Shuttle Cork",
    category: "Badminton",
    price: 95,
    stockQuantity: 40,
    aliases: ["shuttle", "chidiya", "cork", "shuttlecock"],
    active: true,
    lowStockThreshold: 10,
    updatedAt: now(),
  },
];

export const initialStoreData: StoreData = {
  catalog: seedCatalog,
  orders: [],
  conversations: [
    {
      id: "msg-demo-1",
      customerPhone: "+919876500001",
      direction: "inbound",
      body: "Bhaiya, Yonex racket hai kya?",
      actor: "customer",
      createdAt: now(),
    },
    {
      id: "msg-demo-2",
      customerPhone: "+919876500001",
      direction: "outbound",
      body: "Haan ji, Yonex Nanoray 10F available hai. Rs. 1950 ka hai. Pack karun?",
      actor: "ai",
      createdAt: now(),
    },
  ],
  customerStates: [],
};
