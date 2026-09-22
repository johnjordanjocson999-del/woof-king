"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertProduct } from "@/app/actions/admin";
import { CATEGORY_OPTIONS, ALLERGEN_OPTIONS } from "@/lib/brand";
import { Field, Notice } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { ProductPhotoEditor, type PhotoFrame } from "@/components/product-photo-editor";

export function ProductForm({
  product,
}: {
  product?: {
    id: string;
    name: string;
    description: string;
    category: string;
    allergens: string;
    priceCentavos: number;
    sellingUnit: string;
    piecesPerUnit: number;
    storageNotes: string;
    shelfLifeNotes: string;
    imagePath: string | null;
    focalX: number;
    focalY: number;
    imageZoom: number;
    archived: boolean;
    featured: boolean;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState(product?.imagePath ?? null);
  const [frame, setFrame] = useState<PhotoFrame>({
    x: product?.focalX ?? 0.5,
    y: product?.focalY ?? 0.5,
    zoom: product?.imageZoom ?? 1,
  });
  const selectedAllergens = new Set((product?.allergens || "").split(",").filter(Boolean));

  return (
    <form
      className="grid gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("focalX", String(frame.x));
        fd.set("focalY", String(frame.y));
        fd.set("imageZoom", String(frame.zoom));
        startTransition(async () => {
          const result = await upsertProduct(fd);
          setMessage(result.message);
          if (result.ok && result.id && !product) {
            router.push(`/admin/products/${result.id}`);
          }
        });
      }}
    >
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      {message ? <Notice tone="info">{message}</Notice> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(16rem,20rem)]">
        <div className="grid gap-4">
          <Field label="Name" required>
            <input name="name" required defaultValue={product?.name} />
          </Field>
          <Field label="Description">
            <textarea name="description" rows={4} defaultValue={product?.description} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              <select name="category" defaultValue={product?.category ?? "bread"}>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Price (₱)" required>
              <input
                name="price"
                required
                defaultValue={product ? (product.priceCentavos / 100).toFixed(2) : ""}
                placeholder="280.00"
              />
            </Field>
            <Field label="Selling unit">
              <input name="sellingUnit" defaultValue={product?.sellingUnit ?? "piece"} />
            </Field>
            <Field label="Pieces per unit">
              <input
                name="piecesPerUnit"
                type="number"
                min={1}
                defaultValue={product?.piecesPerUnit ?? 1}
              />
            </Field>
          </div>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold">Allergens</legend>
            <div className="flex flex-wrap gap-3">
              {ALLERGEN_OPTIONS.map((a) => (
                <label key={a} className="flex items-center gap-2 text-sm font-normal">
                  <input
                    type="checkbox"
                    name="allergens"
                    value={a}
                    defaultChecked={selectedAllergens.has(a)}
                  />
                  {a}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Storage notes">
            <input name="storageNotes" defaultValue={product?.storageNotes} />
          </Field>
          <Field label="Shelf life notes">
            <input name="shelfLifeNotes" defaultValue={product?.shelfLifeNotes} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="featured" defaultChecked={product?.featured} />
            Featured / best seller (phone home)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="archived" defaultChecked={product?.archived} />
            Archived (hidden from new menus)
          </label>
        </div>

        <div className="grid content-start gap-3">
          <Field label="Photo">
            <input
              name="image"
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setPreview(URL.createObjectURL(file));
                  setFrame({ x: 0.5, y: 0.5, zoom: 1 });
                }
              }}
            />
          </Field>
          <ProductPhotoEditor src={preview} value={frame} onChange={setFrame} />
        </div>
      </div>

      <SubmitButton disabled={pending}>{product ? "Save changes" : "Create product"}</SubmitButton>
    </form>
  );
}
