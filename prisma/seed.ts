/**
 * Seeds a believable week at Woof King: five products with full recipes, the
 * raw materials behind them at real Manila prices, a published rotation, and
 * pickup slots for Sunday.
 *
 * Three ingredients are deliberately left below their reorder threshold so the
 * restock report has something to say the first time it is opened.
 *
 * Run with `npm run seed`. Safe to re-run: it clears the tables it owns first.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { bakeCycleFor, manilaMonthKey, parsePrepWeekdays, addDays, manilaStartOfDay } from "../src/lib/time";
import { slugify } from "../src/lib/ids";

const db = new PrismaClient();

interface IngredientSeed {
  key: string;
  name: string;
  baseUnit: "g" | "ml" | "piece";
  purchaseUnit: string;
  purchaseToBase: string;
  /** Centavos per single base unit. Fractional, so it stays a string. */
  costPerBaseCentavos: string;
  qtyOnHandBase: string;
  reorderThresholdBase: string;
  supplier: string;
}

const INGREDIENTS: IngredientSeed[] = [
  // Flours and the levain.
  {
    key: "bread-flour",
    name: "Bread flour (high gluten)",
    baseUnit: "g",
    purchaseUnit: "sack (25 kg)",
    purchaseToBase: "25000",
    costPerBaseCentavos: "5.4",
    qtyOnHandBase: "18400",
    reorderThresholdBase: "6000",
    supplier: "San Miguel Mills",
  },
  {
    key: "ap-flour",
    name: "All-purpose flour",
    baseUnit: "g",
    purchaseUnit: "kg",
    purchaseToBase: "1000",
    costPerBaseCentavos: "5.8",
    // Below threshold on purpose: shows up in the restock list.
    qtyOnHandBase: "4200",
    reorderThresholdBase: "6000",
    supplier: "San Miguel Mills",
  },
  {
    key: "starter",
    name: "Sourdough starter (levain)",
    baseUnit: "g",
    purchaseUnit: "kg",
    purchaseToBase: "1000",
    costPerBaseCentavos: "5.4",
    qtyOnHandBase: "2600",
    reorderThresholdBase: "800",
    supplier: "In-house",
  },

  // Liquids.
  {
    key: "water",
    name: "Filtered water",
    baseUnit: "ml",
    purchaseUnit: "container (20 L)",
    purchaseToBase: "20000",
    costPerBaseCentavos: "0.125",
    qtyOnHandBase: "60000",
    reorderThresholdBase: "20000",
    supplier: "Aqua Best",
  },
  {
    key: "milk",
    name: "Whole milk",
    baseUnit: "ml",
    purchaseUnit: "L",
    purchaseToBase: "1000",
    costPerBaseCentavos: "9.6",
    qtyOnHandBase: "6000",
    reorderThresholdBase: "2000",
    supplier: "Alaska",
  },
  {
    key: "kalamansi",
    name: "Kalamansi juice",
    baseUnit: "ml",
    purchaseUnit: "L",
    purchaseToBase: "1000",
    costPerBaseCentavos: "19",
    qtyOnHandBase: "700",
    reorderThresholdBase: "250",
    supplier: "Farmers market",
  },

  // Fats, sugars, leaveners.
  {
    key: "butter",
    name: "Unsalted butter",
    baseUnit: "g",
    purchaseUnit: "block (225 g)",
    purchaseToBase: "225",
    costPerBaseCentavos: "82.2222",
    // Below threshold on purpose.
    qtyOnHandBase: "900",
    reorderThresholdBase: "1800",
    supplier: "Anchor",
  },
  {
    key: "sugar",
    name: "White sugar",
    baseUnit: "g",
    purchaseUnit: "kg",
    purchaseToBase: "1000",
    costPerBaseCentavos: "7.8",
    qtyOnHandBase: "7400",
    reorderThresholdBase: "2500",
    supplier: "Victorias",
  },
  {
    key: "salt",
    name: "Fine sea salt",
    baseUnit: "g",
    purchaseUnit: "kg",
    purchaseToBase: "1000",
    costPerBaseCentavos: "3.2",
    qtyOnHandBase: "3100",
    reorderThresholdBase: "800",
    supplier: "Pangasinan salt co-op",
  },
  {
    key: "yeast",
    name: "Instant dry yeast",
    baseUnit: "g",
    purchaseUnit: "pack (500 g)",
    purchaseToBase: "500",
    costPerBaseCentavos: "46",
    qtyOnHandBase: "820",
    reorderThresholdBase: "250",
    supplier: "Saf-instant",
  },
  {
    key: "eggs",
    name: "Fresh eggs (large)",
    baseUnit: "piece",
    purchaseUnit: "tray (30)",
    purchaseToBase: "30",
    costPerBaseCentavos: "883.3333",
    qtyOnHandBase: "96",
    reorderThresholdBase: "36",
    supplier: "Bulacan poultry",
  },

  // Flavour.
  {
    key: "ube",
    name: "Ube halaya",
    baseUnit: "g",
    purchaseUnit: "jar (350 g)",
    purchaseToBase: "350",
    costPerBaseCentavos: "52.8571",
    qtyOnHandBase: "2450",
    reorderThresholdBase: "700",
    supplier: "Good Shepherd",
  },
  {
    key: "quickmelt",
    name: "Quickmelt cheese",
    baseUnit: "g",
    purchaseUnit: "bar (165 g)",
    purchaseToBase: "165",
    costPerBaseCentavos: "44.8485",
    qtyOnHandBase: "1320",
    reorderThresholdBase: "500",
    supplier: "Eden",
  },
  {
    key: "queso",
    name: "Queso de bola, grated",
    baseUnit: "g",
    purchaseUnit: "pack (100 g)",
    purchaseToBase: "100",
    costPerBaseCentavos: "148",
    qtyOnHandBase: "600",
    reorderThresholdBase: "250",
    supplier: "Marca Piña",
  },
  {
    key: "chocolate",
    name: "Dark chocolate 55%",
    baseUnit: "g",
    purchaseUnit: "kg",
    purchaseToBase: "1000",
    costPerBaseCentavos: "64",
    qtyOnHandBase: "2800",
    reorderThresholdBase: "1000",
    supplier: "Auro Chocolate",
  },
  {
    key: "cardamom",
    name: "Ground cardamom",
    baseUnit: "g",
    purchaseUnit: "pack (50 g)",
    purchaseToBase: "50",
    costPerBaseCentavos: "430",
    // Below threshold on purpose.
    qtyOnHandBase: "12",
    reorderThresholdBase: "40",
    supplier: "Spice trade PH",
  },
  {
    key: "breadcrumbs",
    name: "Fine breadcrumbs",
    baseUnit: "g",
    purchaseUnit: "kg",
    purchaseToBase: "1000",
    costPerBaseCentavos: "9.8",
    qtyOnHandBase: "2200",
    reorderThresholdBase: "700",
    supplier: "In-house",
  },

  // New catalog — banana breads, cinnamon rolls, Basque cakes, macarons, focaccia.
  {
    key: "coconut-sugar",
    name: "Coconut sugar",
    baseUnit: "g",
    purchaseUnit: "kg",
    purchaseToBase: "1000",
    costPerBaseCentavos: "28",
    qtyOnHandBase: "3200",
    reorderThresholdBase: "1000",
    supplier: "Quezon coop",
  },
  {
    key: "stevia",
    name: "Stevia blend (baking)",
    baseUnit: "g",
    purchaseUnit: "pack (100 g)",
    purchaseToBase: "100",
    costPerBaseCentavos: "95",
    qtyOnHandBase: "280",
    reorderThresholdBase: "80",
    supplier: "Healthy Options",
  },
  {
    key: "banana",
    name: "Ripe bananas (mashed weight)",
    baseUnit: "g",
    purchaseUnit: "kg",
    purchaseToBase: "1000",
    costPerBaseCentavos: "8.5",
    qtyOnHandBase: "4500",
    reorderThresholdBase: "1500",
    supplier: "Farmers market",
  },
  {
    key: "sour-cream",
    name: "Sour cream",
    baseUnit: "g",
    purchaseUnit: "tub (400 g)",
    purchaseToBase: "400",
    costPerBaseCentavos: "22",
    qtyOnHandBase: "1600",
    reorderThresholdBase: "400",
    supplier: "Angel",
  },
  {
    key: "vanilla",
    name: "Vanilla extract / paste",
    baseUnit: "ml",
    purchaseUnit: "bottle (100 ml)",
    purchaseToBase: "100",
    costPerBaseCentavos: "180",
    qtyOnHandBase: "340",
    reorderThresholdBase: "100",
    supplier: "Nielsen-Massey",
  },
  {
    key: "baking-soda",
    name: "Baking soda",
    baseUnit: "g",
    purchaseUnit: "pack (500 g)",
    purchaseToBase: "500",
    costPerBaseCentavos: "4.2",
    qtyOnHandBase: "900",
    reorderThresholdBase: "200",
    supplier: "ARM & HAMMER",
  },
  {
    key: "baking-powder",
    name: "Baking powder",
    baseUnit: "g",
    purchaseUnit: "pack (450 g)",
    purchaseToBase: "450",
    costPerBaseCentavos: "12",
    qtyOnHandBase: "720",
    reorderThresholdBase: "200",
    supplier: "Calumet",
  },
  {
    key: "cinnamon",
    name: "Ground cinnamon",
    baseUnit: "g",
    purchaseUnit: "pack (100 g)",
    purchaseToBase: "100",
    costPerBaseCentavos: "85",
    qtyOnHandBase: "260",
    reorderThresholdBase: "80",
    supplier: "Spice trade PH",
  },
  {
    key: "walnuts",
    name: "Chopped walnuts / mixed nuts",
    baseUnit: "g",
    purchaseUnit: "kg",
    purchaseToBase: "1000",
    costPerBaseCentavos: "72",
    qtyOnHandBase: "1800",
    reorderThresholdBase: "500",
    supplier: "Divisoria nuts",
  },
  {
    key: "brown-sugar",
    name: "Brown sugar",
    baseUnit: "g",
    purchaseUnit: "kg",
    purchaseToBase: "1000",
    costPerBaseCentavos: "9.2",
    qtyOnHandBase: "4100",
    reorderThresholdBase: "1500",
    supplier: "Victorias",
  },
  {
    key: "powdered-sugar",
    name: "Powdered / confectioners sugar",
    baseUnit: "g",
    purchaseUnit: "kg",
    purchaseToBase: "1000",
    costPerBaseCentavos: "11",
    qtyOnHandBase: "2600",
    reorderThresholdBase: "800",
    supplier: "Victorias",
  },
  {
    key: "cream-cheese",
    name: "Cream cheese (block)",
    baseUnit: "g",
    purchaseUnit: "block (226 g)",
    purchaseToBase: "226",
    costPerBaseCentavos: "48",
    qtyOnHandBase: "2260",
    reorderThresholdBase: "700",
    supplier: "Philadelphia",
  },
  {
    key: "heavy-cream",
    name: "Heavy / whipping cream",
    baseUnit: "ml",
    purchaseUnit: "carton (250 ml)",
    purchaseToBase: "250",
    costPerBaseCentavos: "28",
    qtyOnHandBase: "2000",
    reorderThresholdBase: "750",
    supplier: "Nestlé",
  },
  {
    key: "greek-yogurt",
    name: "Plain Greek yogurt",
    baseUnit: "g",
    purchaseUnit: "tub (400 g)",
    purchaseToBase: "400",
    costPerBaseCentavos: "18",
    qtyOnHandBase: "1200",
    reorderThresholdBase: "400",
    supplier: "Emborg",
  },
  {
    key: "matcha",
    name: "Culinary matcha powder",
    baseUnit: "g",
    purchaseUnit: "tin (100 g)",
    purchaseToBase: "100",
    costPerBaseCentavos: "220",
    qtyOnHandBase: "180",
    reorderThresholdBase: "50",
    supplier: "Aiya",
  },
  {
    key: "cornstarch",
    name: "Cornstarch",
    baseUnit: "g",
    purchaseUnit: "pack (500 g)",
    purchaseToBase: "500",
    costPerBaseCentavos: "6.5",
    qtyOnHandBase: "1100",
    reorderThresholdBase: "300",
    supplier: "Knorr",
  },
  {
    key: "caramel",
    name: "Caramel sauce",
    baseUnit: "g",
    purchaseUnit: "jar (350 g)",
    purchaseToBase: "350",
    costPerBaseCentavos: "38",
    qtyOnHandBase: "1050",
    reorderThresholdBase: "350",
    supplier: "In-house / store",
  },
  {
    key: "condensed-milk",
    name: "Sweetened condensed milk",
    baseUnit: "g",
    purchaseUnit: "can (300 g)",
    purchaseToBase: "300",
    costPerBaseCentavos: "16",
    qtyOnHandBase: "1800",
    reorderThresholdBase: "600",
    supplier: "Alaska",
  },
  {
    key: "shredded-coconut",
    name: "Sweetened shredded coconut",
    baseUnit: "g",
    purchaseUnit: "pack (200 g)",
    purchaseToBase: "200",
    costPerBaseCentavos: "22",
    qtyOnHandBase: "1600",
    reorderThresholdBase: "400",
    supplier: "Desiccated coconut PH",
  },
  {
    key: "cream-of-tartar",
    name: "Cream of tartar",
    baseUnit: "g",
    purchaseUnit: "pack (50 g)",
    purchaseToBase: "50",
    costPerBaseCentavos: "55",
    qtyOnHandBase: "90",
    reorderThresholdBase: "25",
    supplier: "McCormick",
  },
  {
    key: "almond-flour",
    name: "Almond flour (blanched)",
    baseUnit: "g",
    purchaseUnit: "kg",
    purchaseToBase: "1000",
    costPerBaseCentavos: "95",
    qtyOnHandBase: "1400",
    reorderThresholdBase: "400",
    supplier: "Bob's / local mill",
  },
  {
    key: "coconut-oil",
    name: "Coconut oil",
    baseUnit: "ml",
    purchaseUnit: "bottle (500 ml)",
    purchaseToBase: "500",
    costPerBaseCentavos: "18",
    qtyOnHandBase: "900",
    reorderThresholdBase: "250",
    supplier: "Minola",
  },
  {
    key: "olive-oil",
    name: "Olive oil",
    baseUnit: "ml",
    purchaseUnit: "bottle (1 L)",
    purchaseToBase: "1000",
    costPerBaseCentavos: "32",
    qtyOnHandBase: "2200",
    reorderThresholdBase: "700",
    supplier: "Bertolli",
  },
  {
    key: "honey",
    name: "Honey",
    baseUnit: "g",
    purchaseUnit: "jar (500 g)",
    purchaseToBase: "500",
    costPerBaseCentavos: "28",
    qtyOnHandBase: "900",
    reorderThresholdBase: "250",
    supplier: "Local apiary",
  },
  {
    key: "rosemary",
    name: "Fresh rosemary leaves",
    baseUnit: "g",
    purchaseUnit: "bunch (30 g)",
    purchaseToBase: "30",
    costPerBaseCentavos: "40",
    qtyOnHandBase: "90",
    reorderThresholdBase: "30",
    supplier: "Farmers market",
  },
  {
    key: "egg-whites",
    name: "Egg whites (separated)",
    baseUnit: "g",
    purchaseUnit: "tray equivalent",
    purchaseToBase: "1000",
    costPerBaseCentavos: "18",
    qtyOnHandBase: "800",
    reorderThresholdBase: "250",
    supplier: "Bulacan poultry",
  },

  // Packaging is costed exactly like an ingredient, just tagged differently on
  // the recipe line so reports can separate food cost from packaging.
  {
    key: "paper-bag",
    name: "Kraft paper bag",
    baseUnit: "piece",
    purchaseUnit: "pack (100)",
    purchaseToBase: "100",
    costPerBaseCentavos: "185",
    qtyOnHandBase: "320",
    reorderThresholdBase: "150",
    supplier: "Divisoria packaging",
  },
  {
    key: "paper-case",
    name: "Fluted paper case",
    baseUnit: "piece",
    purchaseUnit: "pack (100)",
    purchaseToBase: "100",
    costPerBaseCentavos: "125",
    qtyOnHandBase: "480",
    reorderThresholdBase: "200",
    supplier: "Divisoria packaging",
  },
  {
    key: "bakery-box",
    name: "Bakery box, small",
    baseUnit: "piece",
    purchaseUnit: "pack (50)",
    purchaseToBase: "50",
    costPerBaseCentavos: "860",
    qtyOnHandBase: "72",
    reorderThresholdBase: "40",
    supplier: "Divisoria packaging",
  },
];

interface RecipeLineSeed {
  ingredient: string;
  qty: string;
  unit: string;
  kind?: "ingredient" | "packaging";
}

interface ProductSeed {
  name: string;
  category: string;
  description: string;
  allergens: string;
  priceCentavos: number;
  sellingUnit: string;
  piecesPerUnit: number;
  imagePath: string;
  storageNotes: string;
  shelfLifeNotes: string;
  counterStock: number;
  /** How many sellable units one full batch of this recipe produces. */
  yieldPieces: number;
  ovenMinutes: number;
  laborCentavos: number;
  instructions: string;
  lines: RecipeLineSeed[];
  /** Cap for this week's rotation. 0 means uncapped. */
  weeklyLimit: number;
  onMenu: boolean;
}

const PRODUCTS: ProductSeed[] = [
  {
    name: "Midnight Sourdough",
    category: "bread",
    description:
      "Twenty-four hours of cold fermentation on our own levain, baked dark in the last hour before dawn. Open crumb, blistered crust, faintly sour and deeply wheaty.",
    allergens: "gluten,wheat",
    priceCentavos: 28000,
    sellingUnit: "loaf",
    piecesPerUnit: 1,
    imagePath: "/uploads/sourdough-loaf.png",
    storageNotes: "Cut side down on a board. Never the fridge.",
    shelfLifeNotes: "Best within 3 days. Freezes well sliced.",
    counterStock: 0,
    yieldPieces: 4,
    ovenMinutes: 55,
    laborCentavos: 6000,
    instructions:
      "Autolyse 1 hour. Four sets of folds across 3 hours. Bulk 5 hours at 26C. Shape, retard overnight. Bake 250C with steam 20 min, 230C dry 25 min.",
    lines: [
      { ingredient: "bread-flour", qty: "2", unit: "kg" },
      { ingredient: "water", qty: "1.4", unit: "l" },
      { ingredient: "starter", qty: "400", unit: "g" },
      { ingredient: "salt", qty: "44", unit: "g" },
      { ingredient: "paper-bag", qty: "4", unit: "piece", kind: "packaging" },
    ],
    weeklyLimit: 24,
    onMenu: true,
  },
  {
    name: "Ube Cheese Pandesal",
    category: "bread",
    description:
      "Soft purple rolls rolled in fine crumbs, filled with Good Shepherd ube halaya and a salted quickmelt centre that goes molten when you warm them.",
    allergens: "gluten,wheat,dairy,eggs",
    priceCentavos: 16000,
    sellingUnit: "pack of 6",
    piecesPerUnit: 6,
    imagePath: "/uploads/ube-pandesal.png",
    storageNotes: "Airtight at room temperature.",
    shelfLifeNotes: "Best on day one. Reheat 6 minutes at 160C.",
    counterStock: 0,
    yieldPieces: 6,
    ovenMinutes: 22,
    laborCentavos: 5000,
    instructions:
      "Tangzhong with 60 g flour and 300 ml milk. Knead to window pane. First rise 1 hour. Fill, crumb, proof 45 min. Bake 165C for 18 min.",
    lines: [
      { ingredient: "ap-flour", qty: "1", unit: "kg" },
      { ingredient: "milk", qty: "400", unit: "ml" },
      { ingredient: "sugar", qty: "150", unit: "g" },
      { ingredient: "butter", qty: "120", unit: "g" },
      { ingredient: "eggs", qty: "2", unit: "piece" },
      { ingredient: "yeast", qty: "14", unit: "g" },
      { ingredient: "salt", qty: "12", unit: "g" },
      { ingredient: "ube", qty: "420", unit: "g" },
      { ingredient: "quickmelt", qty: "216", unit: "g" },
      { ingredient: "breadcrumbs", qty: "150", unit: "g" },
      { ingredient: "paper-bag", qty: "6", unit: "piece", kind: "packaging" },
    ],
    weeklyLimit: 40,
    onMenu: true,
  },
  {
    name: "Brown Butter Ensaymada",
    category: "pastry",
    description:
      "The butter is browned first, which is the whole difference. Coiled, proofed slow, then finished with more butter and a heavy fall of grated queso de bola.",
    allergens: "gluten,wheat,dairy,eggs",
    priceCentavos: 8500,
    sellingUnit: "piece",
    piecesPerUnit: 1,
    imagePath: "/uploads/ensaymada.png",
    storageNotes: "Cool, covered. Butter softens in Manila heat.",
    shelfLifeNotes: "Best within 2 days.",
    counterStock: 8,
    yieldPieces: 24,
    ovenMinutes: 18,
    laborCentavos: 4500,
    instructions:
      "Brown 300 g butter, cool to soft. Enriched dough, 2 hour bulk. Coil into cases, proof 1 hour. Bake 170C for 16 min. Top warm.",
    lines: [
      { ingredient: "ap-flour", qty: "700", unit: "g" },
      { ingredient: "eggs", qty: "6", unit: "piece" },
      { ingredient: "butter", qty: "300", unit: "g" },
      { ingredient: "sugar", qty: "140", unit: "g" },
      { ingredient: "milk", qty: "180", unit: "ml" },
      { ingredient: "yeast", qty: "12", unit: "g" },
      { ingredient: "salt", qty: "8", unit: "g" },
      { ingredient: "queso", qty: "120", unit: "g" },
      { ingredient: "paper-case", qty: "24", unit: "piece", kind: "packaging" },
    ],
    weeklyLimit: 48,
    onMenu: true,
  },
  {
    name: "Dark Chocolate Babka",
    category: "pastry",
    description:
      "Auro 55% melted into brown butter, laminated through an enriched dough, twisted and soaked in syrup the moment it leaves the oven.",
    allergens: "gluten,wheat,dairy,eggs,soy",
    priceCentavos: 34000,
    sellingUnit: "loaf",
    piecesPerUnit: 1,
    imagePath: "/uploads/chocolate-babka.png",
    storageNotes: "Wrapped, room temperature.",
    shelfLifeNotes: "Best within 3 days. Excellent toasted on day 3.",
    counterStock: 0,
    yieldPieces: 4,
    ovenMinutes: 40,
    laborCentavos: 7500,
    instructions:
      "Enriched dough, overnight cold rest. Spread chocolate paste, roll, cut, twist. Proof 2 hours. Bake 180C for 35 min. Syrup while hot.",
    lines: [
      { ingredient: "ap-flour", qty: "1", unit: "kg" },
      { ingredient: "butter", qty: "350", unit: "g" },
      { ingredient: "eggs", qty: "4", unit: "piece" },
      { ingredient: "milk", qty: "250", unit: "ml" },
      { ingredient: "sugar", qty: "180", unit: "g" },
      { ingredient: "yeast", qty: "14", unit: "g" },
      { ingredient: "salt", qty: "10", unit: "g" },
      { ingredient: "chocolate", qty: "500", unit: "g" },
      { ingredient: "bakery-box", qty: "4", unit: "piece", kind: "packaging" },
    ],
    weeklyLimit: 16,
    onMenu: true,
  },
  {
    name: "Cardamom Morning Bun",
    category: "pastry",
    description:
      "Laminated, knotted, rolled in cardamom sugar and finished with a kalamansi glaze that cuts straight through the butter.",
    allergens: "gluten,wheat,dairy",
    priceCentavos: 9500,
    sellingUnit: "piece",
    piecesPerUnit: 1,
    imagePath: "/uploads/cardamom-bun.png",
    storageNotes: "Eat the day they are baked.",
    shelfLifeNotes: "Day one only. This is not a keeper.",
    counterStock: 5,
    yieldPieces: 18,
    ovenMinutes: 24,
    laborCentavos: 8000,
    instructions:
      "Three folds with a 400 g butter block, resting 40 min between. Knot, proof 90 min. Bake 190C for 22 min. Roll in cardamom sugar, glaze.",
    lines: [
      { ingredient: "ap-flour", qty: "800", unit: "g" },
      { ingredient: "butter", qty: "400", unit: "g" },
      { ingredient: "milk", qty: "380", unit: "ml" },
      { ingredient: "sugar", qty: "220", unit: "g" },
      { ingredient: "yeast", qty: "12", unit: "g" },
      { ingredient: "salt", qty: "9", unit: "g" },
      { ingredient: "cardamom", qty: "18", unit: "g" },
      { ingredient: "kalamansi", qty: "40", unit: "ml" },
      { ingredient: "paper-case", qty: "18", unit: "piece", kind: "packaging" },
    ],
    weeklyLimit: 36,
    onMenu: true,
  },
  {
    name: "Coconut Sugar Banana Bread",
    category: "bread",
    description:
      "Three loaves of banana bread creamed with coconut sugar and stevia, roasted banana mash, sour cream for moisture, and cinnamon that loves the coconut sugar. Optional nuts or chocolate chips folded through.",
    allergens: "gluten,wheat,dairy,eggs,tree-nuts",
    priceCentavos: 32000,
    sellingUnit: "loaf",
    piecesPerUnit: 1,
    imagePath: "/uploads/banana-bread.png",
    storageNotes: "Wrapped at room temperature. Cool completely before wrapping.",
    shelfLifeNotes: "Best within 3 days. Freezes well sliced.",
    counterStock: 0,
    yieldPieces: 3,
    ovenMinutes: 55,
    laborCentavos: 5500,
    instructions:
      "Preheat oven to 350°F (175°C). Cream 340 g softened butter with 300 g coconut sugar until light. Beat in stevia to the sweetness of ~1½ cups sugar (check your brand chart). Add ~300 g eggs (6 large) and beat in. Fold in 1,000–1,080 g roasted/softened mashed bananas, 260 g sour cream, and 13 g vanilla. In a separate bowl sift 720 g all-purpose flour, 18 g baking soda, 9 g salt, and 4 g ground cinnamon. Gradually mix dry into wet. Stir in 150–200 g nuts or chocolate chips. Divide into 3 greased loaf pans. Bake 45–60 min until a toothpick comes out clean. Alternate: 350°F for 40 min, then 325°F for 20 min for a gentler bake.",
    lines: [
      { ingredient: "butter", qty: "340", unit: "g" },
      { ingredient: "coconut-sugar", qty: "300", unit: "g" },
      { ingredient: "stevia", qty: "18", unit: "g" },
      { ingredient: "eggs", qty: "6", unit: "piece" },
      { ingredient: "banana", qty: "1040", unit: "g" },
      { ingredient: "sour-cream", qty: "260", unit: "g" },
      { ingredient: "vanilla", qty: "13", unit: "ml" },
      { ingredient: "ap-flour", qty: "720", unit: "g" },
      { ingredient: "baking-soda", qty: "18", unit: "g" },
      { ingredient: "salt", qty: "9", unit: "g" },
      { ingredient: "cinnamon", qty: "4", unit: "g" },
      { ingredient: "walnuts", qty: "175", unit: "g" },
      { ingredient: "paper-bag", qty: "3", unit: "piece", kind: "packaging" },
    ],
    weeklyLimit: 18,
    onMenu: true,
  },
  {
    name: "Soft Sourdough Cinnamon Rolls",
    category: "pastry",
    description:
      "Overnight sourdough sweet rolls with a not-too-sweet cinnamon filling and cream-cheese glaze. Soft, brunch-ready, and built for holiday mornings.",
    allergens: "gluten,wheat,dairy,eggs",
    priceCentavos: 12000,
    sellingUnit: "piece",
    piecesPerUnit: 1,
    imagePath: "/uploads/cinnamon-rolls.png",
    storageNotes: "Covered at room temperature day of bake. Refrigerate leftover glaze.",
    shelfLifeNotes: "Best day one. Freeze shaped unbaked up to 3 months.",
    counterStock: 0,
    yieldPieces: 12,
    ovenMinutes: 38,
    laborCentavos: 7000,
    instructions:
      "Sweet dough: 160 g milk, 28 g melted unsalted butter (cooled), 1 large egg, 100 g bubbly active starter, 24 g sugar, 300 g AP flour, 5 g fine sea salt. Mix, coat lightly with oil, rest overnight 10–12 hours (do not add baking powder/soda yet). Richer variation: 115 g butter + 360 g flour. Filling (leak-proof update): combine 84 g softened butter with 100 g sugar, 3 tsp cinnamon, and 1 tbsp flour. Next morning: mix baking powder + baking soda, work into dough. Roll 12×24 in rectangle, fill, roll, cut 12 pieces into buttered 12 in cast iron. Bake 375°F 35–40 min until golden. Glaze: 2 tbsp soft butter, ⅓ cup whipped cream cheese, ¼–½ cup sifted powdered sugar, 1–2 tbsp milk; glaze hot. From frozen: bake uncovered 350°F 40–45 min, no thaw. Active starter only: skip soda/powder and proof shaped rolls 1–1.5 hr before bake. Non-cast-iron: 25–30 min, tent foil at 15–20 min if browning fast.",
    lines: [
      { ingredient: "milk", qty: "160", unit: "ml" },
      { ingredient: "butter", qty: "140", unit: "g" },
      { ingredient: "eggs", qty: "1", unit: "piece" },
      { ingredient: "starter", qty: "100", unit: "g" },
      { ingredient: "sugar", qty: "124", unit: "g" },
      { ingredient: "ap-flour", qty: "308", unit: "g" },
      { ingredient: "salt", qty: "5", unit: "g" },
      { ingredient: "cinnamon", qty: "8", unit: "g" },
      { ingredient: "baking-powder", qty: "4", unit: "g" },
      { ingredient: "baking-soda", qty: "3", unit: "g" },
      { ingredient: "cream-cheese", qty: "80", unit: "g" },
      { ingredient: "powdered-sugar", qty: "60", unit: "g" },
      { ingredient: "paper-case", qty: "12", unit: "piece", kind: "packaging" },
    ],
    weeklyLimit: 36,
    onMenu: true,
  },
  {
    name: "Two Sourdough Loaves",
    category: "bread",
    description:
      "Baker’s-percentage country loaves — 70% hydration, overnight cold retard, Dutch-oven bake with ice for steam. Split the dough mid-bulk if you want two flavours (e.g. malunggay).",
    allergens: "gluten,wheat",
    priceCentavos: 28000,
    sellingUnit: "loaf",
    piecesPerUnit: 1,
    imagePath: "/uploads/two-sourdough.png",
    storageNotes: "Cut side down on a board. Never the fridge.",
    shelfLifeNotes: "Best within 3 days. Freezes well sliced.",
    counterStock: 0,
    yieldPieces: 2,
    ovenMinutes: 45,
    laborCentavos: 6500,
    instructions:
      "Autolyse: mix 1,000 g bread flour + 670 g warm water (~27°C / 80°F), reserve 30 g water; rest 30–45 min. Dimple in 200 g active starter; knead; rest 20 min. Add 20 g fine sea salt + reserved 30 g water; slap-and-fold until smooth. Bulk 3–5 hr: 4 stretch-and-folds every 30 min (sets 1–2 standard; sets 3–4 coil folds). Optional: split dough in half after set 2 and laminate add-ins. Rest until +30–50% volume with surface bubbles. Divide ~960 g each, preshape boules, rest 15–20 min uncovered. Final shape into boule/cylinder, seam-up in floured bannetons, rice-flour dust, cold proof 12–16 hr. Preheat Dutch oven 245°C (475°F) 45–60 min. Score, drop in with 2 ice cubes under parchment. Lid on 230°C (450°F) 20 min; lid off 215°C (420°F) 20–25 min to deep mahogany. Cool ≥2 hr before slicing.",
    lines: [
      { ingredient: "bread-flour", qty: "1000", unit: "g" },
      { ingredient: "water", qty: "700", unit: "ml" },
      { ingredient: "starter", qty: "200", unit: "g" },
      { ingredient: "salt", qty: "20", unit: "g" },
      { ingredient: "paper-bag", qty: "2", unit: "piece", kind: "packaging" },
    ],
    weeklyLimit: 20,
    onMenu: true,
  },
  {
    name: "Salted Caramel Banana Bread",
    category: "bread",
    description:
      "Brown-butter banana loaf with cinnamon crumb, finished with homemade salted caramel and caramel cream-cheese frosting.",
    allergens: "gluten,wheat,dairy,eggs",
    priceCentavos: 38000,
    sellingUnit: "loaf",
    piecesPerUnit: 1,
    imagePath: "/uploads/salted-caramel-banana-bread.png",
    storageNotes: "Frosted loaf refrigerated. Bring to room temp before serving.",
    shelfLifeNotes: "Best within 3 days refrigerated.",
    counterStock: 0,
    yieldPieces: 1,
    ovenMinutes: 50,
    laborCentavos: 8000,
    instructions:
      "Preheat 375°F; line a loaf pan with parchment. Whisk mashed bananas (3 medium) with 113 g browned salted butter; whisk in 100 g brown sugar + 50 g granulated sugar. Add 1 room-temp egg, 60 g Greek yogurt, 13 g vanilla paste. Fold in 240 g AP flour, 4 g baking powder, 5 g baking soda, 3 g salt, 2 tsp cinnamon until mostly combined (few flour streaks OK). Bake 5 min at 375°F, then 350°F for 40–50 min until toothpick shows moist crumbs. Salted caramel: melt 200 g sugar over medium until amber; low heat, whisk in 85 g room-temp salted butter; slowly whisk in 120 g warm heavy cream; bubble 1 min; off heat add 2 g vanilla + flaky salt; cool slightly. Frosting: beat 113 g cream cheese + 28 g butter; mix in 2 heaping tbsp caramel + powdered sugar to taste + 1 tbsp vanilla paste. Frost cooled loaf; spoon extra caramel on top.",
    lines: [
      { ingredient: "banana", qty: "360", unit: "g" },
      { ingredient: "butter", qty: "226", unit: "g" },
      { ingredient: "brown-sugar", qty: "100", unit: "g" },
      { ingredient: "sugar", qty: "250", unit: "g" },
      { ingredient: "eggs", qty: "1", unit: "piece" },
      { ingredient: "greek-yogurt", qty: "60", unit: "g" },
      { ingredient: "vanilla", qty: "20", unit: "ml" },
      { ingredient: "ap-flour", qty: "240", unit: "g" },
      { ingredient: "baking-powder", qty: "4", unit: "g" },
      { ingredient: "baking-soda", qty: "5", unit: "g" },
      { ingredient: "salt", qty: "3", unit: "g" },
      { ingredient: "cinnamon", qty: "5", unit: "g" },
      { ingredient: "heavy-cream", qty: "120", unit: "ml" },
      { ingredient: "cream-cheese", qty: "113", unit: "g" },
      { ingredient: "powdered-sugar", qty: "80", unit: "g" },
      { ingredient: "bakery-box", qty: "1", unit: "piece", kind: "packaging" },
    ],
    weeklyLimit: 12,
    onMenu: true,
  },
  {
    name: "Matcha Basque Burnt Cheesecake",
    category: "pastry",
    description:
      "High-heat Basque burnt cheesecake tinted with sifted matcha — dark caramelized top, soft wobbly center, chilled overnight.",
    allergens: "dairy,eggs",
    priceCentavos: 48000,
    sellingUnit: "cake",
    piecesPerUnit: 1,
    imagePath: "/uploads/matcha-basque.png",
    storageNotes: "Refrigerate uncovered or lightly covered after set.",
    shelfLifeNotes: "Best within 4 days chilled. Bring toward room temp to serve.",
    counterStock: 0,
    yieldPieces: 1,
    ovenMinutes: 28,
    laborCentavos: 6000,
    instructions:
      "Preheat 425–450°F (220–230°C). Line a 6-inch round pan with parchment rising 1–2 in above the rim. Beat 450 g room-temp cream cheese with 100 g sugar until smooth. Sift in 1–2 tbsp matcha + pinch salt. Add 3 room-temp eggs one at a time on low; slowly pour in 250 ml room-temp heavy cream until silky. Optional: 1 tbsp cornstarch/flour for firmer texture; 1 tbsp vanilla. Bake 25–30 min until top is dark brown and center still wobbles. Cool completely (will sink), then chill 4–6 hr before slicing. Dust with powdered sugar if desired.",
    lines: [
      { ingredient: "cream-cheese", qty: "450", unit: "g" },
      { ingredient: "sugar", qty: "100", unit: "g" },
      { ingredient: "matcha", qty: "12", unit: "g" },
      { ingredient: "eggs", qty: "3", unit: "piece" },
      { ingredient: "heavy-cream", qty: "250", unit: "ml" },
      { ingredient: "cornstarch", qty: "8", unit: "g" },
      { ingredient: "salt", qty: "1", unit: "g" },
      { ingredient: "vanilla", qty: "15", unit: "ml" },
      { ingredient: "powdered-sugar", qty: "10", unit: "g" },
      { ingredient: "bakery-box", qty: "1", unit: "piece", kind: "packaging" },
    ],
    weeklyLimit: 8,
    onMenu: true,
  },
  {
    name: "Basque Burnt Cheesecake",
    category: "pastry",
    description:
      "Classic 8-inch Basque burnt cheesecake — deep golden soufflé top, creamy center, overnight chill. Served rustic on its parchment.",
    allergens: "dairy,eggs,gluten,wheat",
    priceCentavos: 52000,
    sellingUnit: "cake",
    piecesPerUnit: 1,
    imagePath: "/uploads/basque-cheesecake.png",
    storageNotes: "Refrigerate uncovered after the counter cool.",
    shelfLifeNotes: "Minimum 8 hr chill before serving. Keeps 4 days.",
    counterStock: 0,
    yieldPieces: 1,
    ovenMinutes: 50,
    laborCentavos: 7000,
    instructions:
      "Preheat 220°C / 425°F (200°C fan), shelf middle. Press 2×40 cm scrunched parchment sheets in an X into a 20 cm / 8 in springform (6 cm tall), fold over rim. Beat 750 g room-temp cream cheese 2 min medium until lump-free; add 200 g caster sugar, beat low 10 sec. Whisk ~¼ of 310 ml cream with 30 g flour to a paste; whisk in remaining cream + 1 tsp vanilla. With beater on low, slowly pour cream mix into cheese, then 220 g lightly whisked room-temp eggs (~4–5 large); stop as soon as combined. Pour into pan; bang on counter and pop bubbles 3–5 times. Bake 45 min (up to 65) until deep golden, center still wobbly. Cool in pan ≥2 hr on counter (it sinks), then refrigerate uncovered ≥8 hr. Release pan; lift by paper overhang. Serve chilled or after 30 min at room temp.",
    lines: [
      { ingredient: "cream-cheese", qty: "750", unit: "g" },
      { ingredient: "sugar", qty: "200", unit: "g" },
      { ingredient: "heavy-cream", qty: "310", unit: "ml" },
      { ingredient: "ap-flour", qty: "30", unit: "g" },
      { ingredient: "vanilla", qty: "5", unit: "ml" },
      { ingredient: "eggs", qty: "5", unit: "piece" },
      { ingredient: "bakery-box", qty: "1", unit: "piece", kind: "packaging" },
    ],
    weeklyLimit: 8,
    onMenu: true,
  },
  {
    name: "Samoa Macaroons",
    category: "pastry",
    description:
      "Coconut macaroons folded with caramel and condensed milk, baked until hollow-sounding, then dipped and drizzled in semisweet chocolate.",
    allergens: "eggs,dairy,coconut,soy",
    priceCentavos: 7500,
    sellingUnit: "piece",
    piecesPerUnit: 1,
    imagePath: "/uploads/samoa-macaroons.png",
    storageNotes: "Airtight at cool room temp once chocolate is set.",
    shelfLifeNotes: "Best within 5 days.",
    counterStock: 0,
    yieldPieces: 18,
    ovenMinutes: 12,
    laborCentavos: 4500,
    instructions:
      "Beat 2 egg whites from low to high until light stiff peaks (clean dry bowl). Whisk ½ cup caramel, ½ cup sweetened condensed milk, 2 tbsp flour, and 2 tsp vanilla until smooth. Fold into whites without deflating; fold in 14 oz sweetened shredded coconut. Scoop 2 oz mounds 2 in apart on parchment. Bake 325°F ~12 min until top coconut flakes brown and centers sound hollow. Melt 6 oz finely chopped semisweet chocolate with 1 tsp coconut oil in 30-sec bursts. Dip bottoms, set on parchment; drizzle tops. Cool completely before serving.",
    lines: [
      { ingredient: "egg-whites", qty: "66", unit: "g" },
      { ingredient: "caramel", qty: "160", unit: "g" },
      { ingredient: "condensed-milk", qty: "160", unit: "g" },
      { ingredient: "vanilla", qty: "10", unit: "ml" },
      { ingredient: "shredded-coconut", qty: "397", unit: "g" },
      { ingredient: "ap-flour", qty: "16", unit: "g" },
      { ingredient: "chocolate", qty: "170", unit: "g" },
      { ingredient: "coconut-oil", qty: "5", unit: "ml" },
      { ingredient: "paper-case", qty: "18", unit: "piece", kind: "packaging" },
    ],
    weeklyLimit: 48,
    onMenu: true,
  },
  {
    name: "French Macarons",
    category: "pastry",
    description:
      "Classic French macaron shells — aged whites, stiff meringue, almond flour macaronage to the figure-8, then filled and matured.",
    allergens: "eggs,tree-nuts,dairy",
    priceCentavos: 6500,
    sellingUnit: "piece",
    piecesPerUnit: 1,
    imagePath: "/uploads/french-macarons.png",
    storageNotes: "Filled macarons refrigerated in an airtight box.",
    shelfLifeNotes: "Mature 12–24 hr cold; serve at room temp. Keep up to 5 days.",
    counterStock: 0,
    yieldPieces: 24,
    ovenMinutes: 13,
    laborCentavos: 9000,
    instructions:
      "Age 100 g egg whites 24 hr cold, then bring to room temp. Wipe bowl with lemon/vinegar. Beat whites with 1 g cream of tartar (+ optional ½ tsp extract) to soft peaks; add 80 g superfine sugar in thirds to stiff glossy peaks; fold optional gel color. Sift 125 g almond flour + 125 g confectioners’ sugar; fold whites into dry in 3 additions until batter flows like honey and a figure-8 sinks in ≤10 sec. Pipe 1.5–2 in rounds on mats; bang pans; pop bubbles. Rest 30–60 min until dry/skin forms. Bake 325°F (163°C) 13 min until feet set and tops don’t wobble. Cool 15 min on sheet, then rack. Fill and sandwich; optional mature 12–24 hr refrigerated.",
    lines: [
      { ingredient: "egg-whites", qty: "100", unit: "g" },
      { ingredient: "cream-of-tartar", qty: "1", unit: "g" },
      { ingredient: "vanilla", qty: "2", unit: "ml" },
      { ingredient: "sugar", qty: "80", unit: "g" },
      { ingredient: "almond-flour", qty: "125", unit: "g" },
      { ingredient: "powdered-sugar", qty: "125", unit: "g" },
      { ingredient: "bakery-box", qty: "1", unit: "piece", kind: "packaging" },
    ],
    weeklyLimit: 60,
    onMenu: true,
  },
  {
    name: "Baguette",
    category: "bread",
    description:
      "Three lean baguettes from an overnight cold ferment — honey-kissed dough, scored, baked on stone with steam for a deep golden crust.",
    allergens: "gluten,wheat",
    priceCentavos: 14000,
    sellingUnit: "piece",
    piecesPerUnit: 1,
    imagePath: "/uploads/baguette.png",
    storageNotes: "Paper bag day of bake. Refresh briefly in a hot oven.",
    shelfLifeNotes: "Best day one. Freeze well wrapped.",
    counterStock: 0,
    yieldPieces: 3,
    ovenMinutes: 30,
    laborCentavos: 4000,
    instructions:
      "Mix 500 g AP flour, 360 g water, 10 g salt, 3 g instant yeast, 25 g honey. Rest 15 min. Over 1½ hr do 3 stretch-and-folds, flipping dough after each. Refrigerate covered 12–14 hr. Divide into 3; shape rectangles; rest 45–60 min. Fold into cylinders, roll to ~14–15 in. Proof seam-up on floured couche 30–60 min. Preheat oven 500°F with stone upper half + pan of hot water on bottom. Transfer seam-down to parchment, score 3 times. Slide onto stone; reduce to 475°F; bake 15 min. Remove water pan, rotate, drop to 450°F; bake ~15 min more to deep golden brown.",
    lines: [
      { ingredient: "ap-flour", qty: "500", unit: "g" },
      { ingredient: "water", qty: "360", unit: "ml" },
      { ingredient: "salt", qty: "10", unit: "g" },
      { ingredient: "yeast", qty: "3", unit: "g" },
      { ingredient: "honey", qty: "25", unit: "g" },
      { ingredient: "paper-bag", qty: "3", unit: "piece", kind: "packaging" },
    ],
    weeklyLimit: 24,
    onMenu: true,
  },
  {
    name: "Rosemary Focaccia",
    category: "bread",
    description:
      "High-hydration focaccia with olive oil dimples, flaky salt, and optional rosemary — golden, chewy, and made for tearing.",
    allergens: "gluten,wheat",
    priceCentavos: 26000,
    sellingUnit: "loaf",
    piecesPerUnit: 1,
    imagePath: "/uploads/focaccia.png",
    storageNotes: "Wrapped loosely at room temperature.",
    shelfLifeNotes: "Best within 2 days. Reheat to revive the crust.",
    counterStock: 0,
    yieldPieces: 1,
    ovenMinutes: 25,
    laborCentavos: 3500,
    instructions:
      "Mix 512 g AP or bread flour, 10–15 g kosher salt, 8 g instant yeast, and 455 g lukewarm water (½ cup boiling + 1½ cups cold). Rest / ferment until bubbly (often overnight cold or same-day warm rise). Butter a pan; pour in dough with 2 tbsp olive oil; stretch to corners. Dimple generously, drizzle remaining olive oil, flaky salt, and 1–2 tsp rosemary. Bake hot until deep golden (typically ~425°F / 220°C, 20–30 min depending on pan depth). Cool briefly on a rack before slicing.",
    lines: [
      { ingredient: "ap-flour", qty: "512", unit: "g" },
      { ingredient: "salt", qty: "12", unit: "g" },
      { ingredient: "yeast", qty: "8", unit: "g" },
      { ingredient: "water", qty: "455", unit: "ml" },
      { ingredient: "butter", qty: "15", unit: "g" },
      { ingredient: "olive-oil", qty: "60", unit: "ml" },
      { ingredient: "rosemary", qty: "5", unit: "g" },
      { ingredient: "paper-bag", qty: "1", unit: "piece", kind: "packaging" },
    ],
    weeklyLimit: 16,
    onMenu: true,
  },
];

const SLOTS = [
  { label: "Early collection", start: "08:00", end: "09:30", capacity: 12 },
  { label: "Mid morning", start: "09:30", end: "11:00", capacity: 12 },
  { label: "Afternoon", start: "15:00", end: "16:30", capacity: 10 },
  { label: "Last call", start: "16:30", end: "18:00", capacity: 10 },
];

const DELIVERY_WINDOWS = [
  { dayOffset: -1, label: "Saturday morning", start: "09:00", end: "11:00", capacity: 15 },
  { dayOffset: -1, label: "Saturday afternoon", start: "15:00", end: "18:00", capacity: 15 },
  { dayOffset: 0, label: "Sunday morning", start: "09:00", end: "11:00", capacity: 15 },
  { dayOffset: 0, label: "Sunday afternoon", start: "15:00", end: "18:00", capacity: 15 },
];

async function main() {
  console.log("Clearing seeded tables...");
  // Order matters: children before parents.
  await db.stockMovement.deleteMany();
  await db.purchaseItem.deleteMany();
  await db.purchase.deleteMany();
  await db.productionBatch.deleteMany();
  await db.payment.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.deliveryWindow.deleteMany();
  await db.menuItem.deleteMany();
  await db.weeklyMenu.deleteMany();
  await db.recipeLine.deleteMany();
  await db.recipe.deleteMany();
  await db.product.deleteMany();
  await db.ingredient.deleteMany();
  await db.paymentOption.deleteMany();
  await db.pickupSlot.deleteMany();
  await db.overhead.deleteMany();
  await db.customer.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
  await db.webhookEvent.deleteMany();

  console.log("Settings...");
  const settingsData = {
    bakeryName: "Woof King",
    tagline: "Good bread, happier people.",
    heroHeading: "Where healthy meets delicious.",
    heroBody:
      "A world of outstanding flavours from a short menu, baked fresh once a week. Order Monday to Thursday, we bake Friday through Sunday, and you collect or get delivery on the weekend.",
    story:
      "Woof King started in a Candelaria, Quezon kitchen with one stubborn idea: bread you can eat every day without a second thought. So we bake in small weekly batches with less sugar, real butter and long, slow fermentation, and we keep a diabetic-friendly option on the menu every single week. Four or five things at a time, no preservatives, no improvers, no shortcuts. Guilt-less indulgence is the whole point, and when it is gone it is gone until next Sunday.",
    announcement: "This week's rotation is live. Orders close Thursday 11:59 PM.",
    policies:
      "Every order is paid in full at checkout, which is how we know exactly how much to bake and waste almost nothing. Pickup is Sunday at the slot you choose. Please bring your order code.",
    cancellationPol:
      "Cancel free of charge any time before Thursday cutoff for a full refund. After cutoff the flour is already committed, so we can no longer refund, but you are welcome to send someone else to collect.",
    contactEmail: "justinemerano@gmail.com",
    contactPhone: "09618066662",
    contactTelephone: "042 911 0208",
    pickupAddress:
      "Blk 17, Lot 21 Caliya Street, Caliya Subdivision, Masin Norte, Candelaria Quezon.",
    instagramUrl: "https://instagram.com",
    facebookUrl: "https://facebook.com",
    heroPath: "/uploads/bakehouse-hero.png",
    gcashName: "Justine Bernadeth Merano",
    gcashNumber: "09618066662",
    vybeQrPath: "/uploads/payments/vybe-qr.png",
    maribankQrPath: "/uploads/payments/maribank-qr.png",
    bakeryLatitude: 13.9285,
    bakeryLongitude: 121.425,
    deliveryBaseFeeCentavos: 5000,
    deliveryPerKmCentavos: 0,
    deliveryNote:
      "Delivery is Saturday and Sunday only: 9:00–11:00 and 15:00–18:00. A flat ₱50 fee is added to your order total.",
    prepWeekdays: "5,6,0",
    cutoffWeekday: 4,
    pickupWeekday: 0,
    paymentProvider: "manual",
    vatRegistered: false,
  };
  await db.settings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...settingsData },
    update: settingsData,
  });

  console.log("Payment options...");
  const paymentOptions = [
    {
      slug: "vybe",
      name: "VYBE / InstaPay",
      type: "qr",
      qrImagePath: "/uploads/payments/vybe-qr.png",
      accountName: "Justine Bernadeth Cunan",
      accountNumber: "+63926****499",
      instructions: "Scan with any bank or e-wallet app (InstaPay).",
      pickupOnly: false,
      sortOrder: 1,
    },
    {
      slug: "maribank",
      name: "MariBank",
      type: "qr",
      qrImagePath: "/uploads/payments/maribank-qr.png",
      accountName: "Justine Bernadeth Merano",
      accountNumber: "MariBank ****7146",
      instructions: "Scan with MariBank or any InstaPay app.",
      pickupOnly: false,
      sortOrder: 2,
    },
    {
      slug: "gcash",
      name: "GCash",
      type: "manual",
      qrImagePath: null as string | null,
      accountName: "Justine Bernadeth Merano",
      accountNumber: "09618066662",
      instructions: "Send via GCash to this number, then submit your reference or screenshot.",
      pickupOnly: false,
      sortOrder: 3,
    },
    {
      slug: "cash",
      name: "Cash on pickup",
      type: "cash",
      qrImagePath: null as string | null,
      accountName: "",
      accountNumber: "",
      instructions: "Pay cash at the bakery when you collect. Bring your order code.",
      pickupOnly: true,
      sortOrder: 4,
    },
  ];
  for (const opt of paymentOptions) {
    await db.paymentOption.create({
      data: {
        ...opt,
        active: true,
        availability: "online",
      },
    });
  }

  console.log("Users...");
  await db.user.create({
    data: {
      email: "owner@woofking.ph",
      name: "Justine",
      phone: "09618066662",
      role: "owner",
      passwordHash: await hashPassword("WoofKing!23"),
    },
  });
  await db.user.create({
    data: {
      email: "counter@woofking.ph",
      name: "Counter staff",
      role: "staff",
      passwordHash: await hashPassword("Counter!23"),
    },
  });
  const customerUser = await db.user.create({
    data: {
      email: "maria@example.com",
      name: "Maria Santos",
      phone: "0918 222 7788",
      role: "customer",
      passwordHash: await hashPassword("Customer!23"),
    },
  });
  await db.customer.create({
    data: {
      userId: customerUser.id,
      name: "Maria Santos",
      phone: "0918 222 7788",
      email: "maria@example.com",
      city: "Quezon City",
      barangay: "Teachers Village East",
      addressLine: "22B Malingap Street",
      notes: "Regular. Always asks for the darkest bake of the sourdough.",
    },
  });

  console.log("Pickup slots...");
  for (const [index, slot] of SLOTS.entries()) {
    await db.pickupSlot.create({ data: { ...slot, position: index } });
  }

  console.log("Ingredients...");
  const ingredientIds = new Map<string, string>();
  for (const seed of INGREDIENTS) {
    const created = await db.ingredient.create({
      data: {
        name: seed.name,
        baseUnit: seed.baseUnit,
        purchaseUnit: seed.purchaseUnit,
        purchaseToBase: seed.purchaseToBase,
        costPerBaseCentavos: seed.costPerBaseCentavos,
        qtyOnHandBase: seed.qtyOnHandBase,
        reorderThresholdBase: seed.reorderThresholdBase,
        supplier: seed.supplier,
      },
    });
    ingredientIds.set(seed.key, created.id);

    // Opening balance is recorded as a movement so the ledger explains the
    // on-hand figure rather than it appearing from nowhere.
    await db.stockMovement.create({
      data: {
        type: "adjustment",
        ingredientId: created.id,
        qtyBase: seed.qtyOnHandBase,
        unitCostCentavos: seed.costPerBaseCentavos,
        reason: "Opening balance at setup",
      },
    });
  }

  console.log("Products and recipes...");
  const productIds = new Map<string, string>();
  for (const seed of PRODUCTS) {
    const product = await db.product.create({
      data: {
        slug: slugify(seed.name),
        name: seed.name,
        description: seed.description,
        category: seed.category,
        allergens: seed.allergens,
        imagePath: seed.imagePath,
        priceCentavos: seed.priceCentavos,
        sellingUnit: seed.sellingUnit,
        piecesPerUnit: seed.piecesPerUnit,
        storageNotes: seed.storageNotes,
        shelfLifeNotes: seed.shelfLifeNotes,
        counterStock: seed.counterStock,
      },
    });
    productIds.set(seed.name, product.id);

    const recipe = await db.recipe.create({
      data: {
        productId: product.id,
        yieldPieces: seed.yieldPieces,
        ovenMinutes: seed.ovenMinutes,
        laborCentavos: seed.laborCentavos,
        instructions: seed.instructions,
      },
    });

    for (const [index, line] of seed.lines.entries()) {
      const ingredientId = ingredientIds.get(line.ingredient);
      if (!ingredientId) throw new Error(`Unknown ingredient key: ${line.ingredient}`);
      await db.recipeLine.create({
        data: {
          recipeId: recipe.id,
          ingredientId,
          qty: line.qty,
          unit: line.unit,
          kind: line.kind ?? "ingredient",
          position: index,
        },
      });
    }
  }

  console.log("This week's rotation...");
  const now = new Date();
  const settings = await db.settings.findUniqueOrThrow({ where: { id: "singleton" } });
  const cycle = bakeCycleFor(now, {
    cutoffWeekday: settings.cutoffWeekday,
    cutoffHour: settings.cutoffHour,
    cutoffMinute: settings.cutoffMinute,
    prepWeekdays: parsePrepWeekdays(settings.prepWeekdays),
    pickupWeekday: settings.pickupWeekday,
  });

  const menu = await db.weeklyMenu.create({
    data: {
      title: "This week's table",
      status: "published",
      orderOpensAt: cycle.orderOpensAt,
      cutoffAt: cycle.cutoffAt,
      prepDates: cycle.prepDates.join(","),
      pickupDate: cycle.pickupDate,
      publishedAt: now,
    },
  });

  let position = 0;
  for (const seed of PRODUCTS) {
    if (!seed.onMenu) continue;
    const productId = productIds.get(seed.name);
    if (!productId) continue;
    await db.menuItem.create({
      data: {
        menuId: menu.id,
        productId,
        position,
        priceCentavos: seed.priceCentavos,
        quantityLimit: seed.weeklyLimit,
        soldCount: 0,
      },
    });
    position += 1;
  }

  console.log("Delivery windows (Sat + Sun, 9–11 and 15–18)...");
  for (const [index, window] of DELIVERY_WINDOWS.entries()) {
    await db.deliveryWindow.create({
      data: {
        menuId: menu.id,
        date: manilaStartOfDay(addDays(cycle.pickupDate, window.dayOffset)),
        label: window.label,
        start: window.start,
        end: window.end,
        capacity: window.capacity,
        position: index,
        notes: "Standard weekend handoff. Flat ₱50 delivery fee.",
      },
    });
  }

  console.log("Overhead for this month...");
  await db.overhead.create({
    data: {
      month: manilaMonthKey(now),
      electricityCentavos: 480000,
      gasCentavos: 240000,
      waterCentavos: 62000,
      rentCentavos: 800000,
      laborCentavos: 0,
      otherCentavos: 51000,
      allocationBasis: "units",
      expectedUnits: 420,
      notes:
        "Meralco plus LPG for the deck oven. Labour is costed per recipe instead, so it is left at zero here to avoid counting it twice.",
    },
  });

  console.log("");
  console.log("Done. Sign in at /admin/login");
  console.log("  Owner    owner@woofking.ph    WoofKing!23");
  console.log("  Counter  counter@woofking.ph  Counter!23");
  console.log("  Customer maria@example.com    Customer!23");
  console.log("");
  console.log(`Cutoff   ${cycle.cutoffAt.toISOString()}`);
  console.log(`Pickup   ${cycle.pickupDate.toISOString()}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
