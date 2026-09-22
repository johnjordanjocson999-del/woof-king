import { db } from "@/lib/db";
import type { PaymentOption, Settings } from "@prisma/client";

export type PaymentOptionType = "qr" | "manual" | "cash";

export type CheckoutPaymentOption = {
  slug: string;
  name: string;
  type: PaymentOptionType;
  qrImagePath: string | null;
  accountName: string;
  accountNumber: string;
  instructions: string;
  pickupOnly: boolean;
  body: string;
};

function optionBody(option: PaymentOption): string {
  if (option.type === "cash") {
    return "Pay in cash when you collect. Bring your order code.";
  }
  if (option.type === "qr") {
    return "Scan the QR or transfer manually, then submit your reference.";
  }
  return "Transfer to the account shown, then submit your reference.";
}

export function toCheckoutOption(option: PaymentOption): CheckoutPaymentOption {
  return {
    slug: option.slug,
    name: option.name,
    type: (option.type as PaymentOptionType) || "qr",
    qrImagePath: option.qrImagePath,
    accountName: option.accountName,
    accountNumber: option.accountNumber,
    instructions: option.instructions,
    pickupOnly: option.pickupOnly,
    body: option.instructions.trim() || optionBody(option),
  };
}

/** Active online payment options, optionally filtered by fulfillment. */
export async function listOnlinePaymentOptions(
  fulfillment?: "pickup" | "delivery",
): Promise<CheckoutPaymentOption[]> {
  const rows = await db.paymentOption.findMany({
    where: {
      active: true,
      OR: [{ availability: "online" }, { availability: "both" }],
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return rows
    .filter((row) => {
      if (fulfillment === "delivery" && (row.pickupOnly || row.type === "cash")) {
        return false;
      }
      return true;
    })
    .map(toCheckoutOption);
}

export async function getPaymentOptionBySlug(
  slug: string,
): Promise<PaymentOption | null> {
  return db.paymentOption.findUnique({ where: { slug } });
}

/** Fallback when the catalog is empty (first boot before seed). */
export function legacyPaymentOptions(settings: Settings): CheckoutPaymentOption[] {
  return [
    {
      slug: "vybe",
      name: "VYBE / InstaPay",
      type: "qr",
      qrImagePath: settings.vybeQrPath || "/uploads/payments/vybe-qr.png",
      accountName: settings.gcashName || "Justine Bernadeth Merano",
      accountNumber: settings.gcashNumber || "",
      instructions: "Scan with any bank or e-wallet (InstaPay).",
      pickupOnly: false,
      body: "Scan the QR or transfer manually, then submit your reference.",
    },
    {
      slug: "maribank",
      name: "MariBank",
      type: "qr",
      qrImagePath: settings.maribankQrPath || "/uploads/payments/maribank-qr.png",
      accountName: settings.gcashName || "Justine Bernadeth Merano",
      accountNumber: "",
      instructions: "Scan with MariBank or any InstaPay app.",
      pickupOnly: false,
      body: "Scan the QR or transfer manually, then submit your reference.",
    },
    {
      slug: "gcash",
      name: "GCash",
      type: "qr",
      qrImagePath: null,
      accountName: settings.gcashName || "",
      accountNumber: settings.gcashNumber || "",
      instructions: "Send via GCash to the number below, then upload proof.",
      pickupOnly: false,
      body: "Transfer via GCash, then submit your reference or screenshot.",
    },
    {
      slug: "cash",
      name: "Cash on pickup",
      type: "cash",
      qrImagePath: null,
      accountName: "",
      accountNumber: "",
      instructions: "Pay cash at the bakery when you collect your order.",
      pickupOnly: true,
      body: "Pay in cash when you collect. Bring your order code.",
    },
  ];
}

export async function resolveOnlinePaymentOptions(
  settings: Settings,
  fulfillment?: "pickup" | "delivery",
): Promise<CheckoutPaymentOption[]> {
  if (settings.paymentProvider === "paymongo") {
    const methods = settings.paymongoMethods
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    if (settings.qrphEnabled && !methods.includes("qrph")) methods.push("qrph");
    const labels: Record<string, string> = {
      gcash: "GCash (PayMongo)",
      card: "Card (PayMongo)",
      qrph: "QR Ph (PayMongo)",
    };
    return methods.map((slug) => ({
      slug,
      name: labels[slug] ?? slug,
      type: "manual" as const,
      qrImagePath: null,
      accountName: "",
      accountNumber: "",
      instructions: "You will be redirected to PayMongo to complete payment.",
      pickupOnly: false,
      body: "Hosted checkout via PayMongo.",
    }));
  }

  if (settings.paymentProvider === "mock") {
    return [
      {
        slug: "gcash",
        name: "GCash (demo)",
        type: "manual",
        qrImagePath: null,
        accountName: "",
        accountNumber: "",
        instructions: "Demo payment only.",
        pickupOnly: false,
        body: "Demo — not a real charge.",
      },
      {
        slug: "card",
        name: "Card (demo)",
        type: "manual",
        qrImagePath: null,
        accountName: "",
        accountNumber: "",
        instructions: "Demo payment only.",
        pickupOnly: false,
        body: "Demo — not a real charge.",
      },
    ];
  }

  const fromDb = await listOnlinePaymentOptions(fulfillment);
  if (fromDb.length > 0) return fromDb;

  return legacyPaymentOptions(settings).filter((opt) => {
    if (fulfillment === "delivery" && (opt.pickupOnly || opt.type === "cash")) {
      return false;
    }
    return true;
  });
}

export function slugifyPaymentName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}
