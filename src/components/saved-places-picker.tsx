"use client";

import { useTransition } from "react";
import { Star, Trash2, MapPin } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SavedAddress } from "@/lib/saved-addresses";
import {
  removeSavedAddressAction,
  toggleFavoriteAddressAction,
} from "@/app/actions/saved-addresses";

/**
 * Pick / favorite / remove past delivery places on checkout.
 */
export function SavedPlacesPicker({
  places,
  selectedAddress,
  onPick,
  onPlacesChange,
}: {
  places: SavedAddress[];
  selectedAddress: string;
  onPick: (place: SavedAddress) => void;
  onPlacesChange: (next: SavedAddress[]) => void;
}) {
  const [pending, start] = useTransition();

  if (places.length === 0) return null;

  const favorites = places.filter((p) => p.favorite);
  const recent = places.filter((p) => !p.favorite);

  return (
    <div className="grid gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold">Your places</p>
        <p className="faint text-xs">Tap one to fill the address</p>
      </div>

      {favorites.length > 0 ? (
        <PlaceGroup
          title="Favorites"
          places={favorites}
          selectedAddress={selectedAddress}
          pending={pending}
          onPick={onPick}
          onToggleFavorite={(id, favorite) =>
            start(async () => {
              const place = places.find((p) => p.id === id);
              const next = await toggleFavoriteAddressAction(id, favorite, place
                ? {
                    address: place.address,
                    instructions: place.instructions,
                    label: place.label || (favorite ? "Favorite" : ""),
                  }
                : undefined);
              onPlacesChange(next);
            })
          }
          onRemove={(id) =>
            start(async () => {
              const next = await removeSavedAddressAction(id);
              onPlacesChange(next);
            })
          }
        />
      ) : null}

      {recent.length > 0 ? (
        <PlaceGroup
          title={favorites.length > 0 ? "Recent" : "Saved & recent"}
          places={recent}
          selectedAddress={selectedAddress}
          pending={pending}
          onPick={onPick}
          onToggleFavorite={(id, favorite) =>
            start(async () => {
              const place = places.find((p) => p.id === id);
              const next = await toggleFavoriteAddressAction(id, favorite, place
                ? {
                    address: place.address,
                    instructions: place.instructions,
                    label: place.label || (favorite ? "Favorite" : ""),
                  }
                : undefined);
              onPlacesChange(next);
            })
          }
          onRemove={(id) =>
            start(async () => {
              const next = await removeSavedAddressAction(id);
              onPlacesChange(next);
            })
          }
        />
      ) : null}
    </div>
  );
}

function PlaceGroup({
  title,
  places,
  selectedAddress,
  pending,
  onPick,
  onToggleFavorite,
  onRemove,
}: {
  title: string;
  places: SavedAddress[];
  selectedAddress: string;
  pending: boolean;
  onPick: (place: SavedAddress) => void;
  onToggleFavorite: (id: string, favorite: boolean) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <p className="eyebrow text-[0.65rem]">{title}</p>
      <ul className="grid gap-2">
        {places.map((place) => {
          const active =
            selectedAddress.trim().toLowerCase() === place.address.trim().toLowerCase();
          return (
            <li key={place.id}>
              <div
                className={cn(
                  "grid gap-2 rounded-[var(--radius-md)] border px-3 py-2.5",
                  active
                    ? "border-[var(--ember)] bg-[color-mix(in_oklab,var(--ember)_12%,var(--surface))]"
                    : "border-[var(--line)] bg-[var(--surface)]",
                )}
              >
                <button
                  type="button"
                  className="grid grid-cols-[auto_1fr] items-start gap-2.5 text-left"
                  onClick={() => onPick(place)}
                >
                  <MapPin
                    size={16}
                    className={cn(
                      "mt-0.5 shrink-0",
                      place.favorite ? "text-[var(--ember)]" : "text-[var(--faint)]",
                    )}
                    aria-hidden
                  />
                  <span className="grid gap-0.5">
                    {place.label ? (
                      <span className="text-xs font-semibold text-[var(--ember-glow)]">
                        {place.label}
                      </span>
                    ) : null}
                    <span className="text-sm leading-5 text-[var(--paper)]">{place.address}</span>
                    {place.instructions ? (
                      <span className="muted text-xs leading-4">{place.instructions}</span>
                    ) : null}
                  </span>
                </button>
                <div className="flex flex-wrap items-center gap-1.5 pl-7">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={pending}
                    aria-pressed={place.favorite}
                    aria-label={place.favorite ? "Remove from favorites" : "Add to favorites"}
                    onClick={() => onToggleFavorite(place.id, !place.favorite)}
                  >
                    <Star
                      size={14}
                      className={place.favorite ? "fill-[var(--ember)] text-[var(--ember)]" : ""}
                      aria-hidden
                    />
                    {place.favorite ? "Favorited" : "Favorite"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={pending}
                    aria-label="Remove saved place"
                    onClick={() => onRemove(place.id)}
                  >
                    <Trash2 size={14} aria-hidden />
                    Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
