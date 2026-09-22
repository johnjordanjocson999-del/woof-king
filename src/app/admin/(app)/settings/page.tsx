import { getSettings } from "@/lib/settings";
import { saveSettings } from "@/app/actions/admin";
import { Card, Eyebrow, Field, Notice } from "@/components/ui";
import { SubmitButton } from "@/components/form";

export default async function AdminSettingsPage() {
  const s = await getSettings();

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <Eyebrow>Bakery</Eyebrow>
        <h1 className="text-[2.2rem] leading-[1]">Settings</h1>
      </header>

      <form action={saveSettings} className="grid gap-8">
        <Card className="grid gap-4 p-5">
          <h2 className="font-display text-xl">Storefront copy</h2>
          <Field label="Bakery name">
            <input name="bakeryName" defaultValue={s.bakeryName} />
          </Field>
          <Field label="Tagline">
            <input name="tagline" defaultValue={s.tagline} />
          </Field>
          <Field label="Hero heading">
            <input name="heroHeading" defaultValue={s.heroHeading} />
          </Field>
          <Field label="Hero body">
            <textarea name="heroBody" rows={3} defaultValue={s.heroBody} />
          </Field>
          <Field label="Story">
            <textarea name="story" rows={5} defaultValue={s.story} />
          </Field>
          <Field label="Announcement">
            <input name="announcement" defaultValue={s.announcement} />
          </Field>
          <Field label="Hero image">
            <input name="hero" type="file" accept="image/*" />
          </Field>
        </Card>

        <Card className="grid gap-4 p-5">
          <h2 className="font-display text-xl">Contact & pickup</h2>
          <Field label="Email">
            <input name="contactEmail" defaultValue={s.contactEmail} type="email" />
          </Field>
          <Field label="Phone (mobile)">
            <input name="contactPhone" defaultValue={s.contactPhone} />
          </Field>
          <Field label="Telephone (landline)">
            <input name="contactTelephone" defaultValue={s.contactTelephone} />
          </Field>
          <Field label="Pickup address">
            <textarea name="pickupAddress" rows={3} defaultValue={s.pickupAddress} />
          </Field>
          <Field label="Delivery note (shown at checkout)">
            <textarea name="deliveryNote" rows={3} defaultValue={s.deliveryNote} />
          </Field>
          <Field label="Policies">
            <textarea name="policies" rows={3} defaultValue={s.policies} />
          </Field>
          <Field label="Cancellation policy">
            <textarea name="cancellationPol" rows={3} defaultValue={s.cancellationPol} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cutoff hour (0–23)">
              <input name="cutoffHour" type="number" min={0} max={23} defaultValue={s.cutoffHour} />
            </Field>
            <Field label="Cutoff minute">
              <input
                name="cutoffMinute"
                type="number"
                min={0}
                max={59}
                defaultValue={s.cutoffMinute}
              />
            </Field>
          </div>
        </Card>

        <Card className="grid gap-4 p-5">
          <h2 className="font-display text-xl">Payments</h2>
          <Notice tone="info" title="Manual QR payments">
            Customers choose VYBE or MariBank at checkout, then scan the QR or transfer manually on
            the order page. PayMongo is optional for card/GCash hosted checkout.
          </Notice>
          <Field label="Provider">
            <select name="paymentProvider" defaultValue={s.paymentProvider}>
              <option value="manual">Manual QR (VYBE + MariBank)</option>
              <option value="paymongo">PayMongo (GCash + card)</option>
              <option value="mock">Mock (demo only)</option>
            </select>
          </Field>
          <Field label="Account name (display)">
            <input name="gcashName" defaultValue={s.gcashName} />
          </Field>
          <Field label="Mobile number (display)">
            <input name="gcashNumber" defaultValue={s.gcashNumber} />
          </Field>
          <Field label="VYBE QR image path">
            <input name="vybeQrPath" defaultValue={s.vybeQrPath} />
          </Field>
          <Field label="MariBank QR image path">
            <input name="maribankQrPath" defaultValue={s.maribankQrPath} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Flat delivery fee (centavos)" hint="5000 = ₱50">
              <input
                name="deliveryBaseFeeCentavos"
                type="number"
                min={0}
                defaultValue={s.deliveryBaseFeeCentavos}
              />
            </Field>
          </div>
          <Field label="PayMongo secret key" hint="sk_test_… for sandbox">
            <input
              name="paymongoSecretKey"
              type="password"
              defaultValue={s.paymongoSecretKey ?? ""}
              autoComplete="off"
            />
          </Field>
          <Field label="PayMongo webhook secret">
            <input
              name="paymongoWebhookKey"
              type="password"
              defaultValue={s.paymongoWebhookKey ?? ""}
              autoComplete="off"
            />
          </Field>
          <Field label="PayMongo methods" hint="Comma-separated: gcash,card,qrph">
            <input name="paymongoMethods" defaultValue={s.paymongoMethods} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="qrphEnabled" defaultChecked={s.qrphEnabled} />
            Enable QR Ph (requires registered merchant)
          </label>
        </Card>

        <Card className="grid gap-4 p-5">
          <h2 className="font-display text-xl">Member loyalty</h2>
          <Notice tone="info" title="Account holders only">
            Guests checkout at full price. Signed-in customers unlock volume discounts, weekly
            streak rewards, and cashback that can be redeemed on later orders.
          </Notice>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="loyaltyEnabled" defaultChecked={s.loyaltyEnabled} />
            Enable member loyalty discounts
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Volume threshold (pieces)" hint="Lifetime paid product pieces">
              <input
                name="loyaltyVolumeThreshold"
                type="number"
                min={1}
                defaultValue={s.loyaltyVolumeThreshold}
              />
            </Field>
            <Field label="Volume discount (%)" hint="e.g. 20 = 20% off products">
              <input
                name="loyaltyVolumeDiscountPercent"
                type="number"
                min={0}
                max={100}
                step={1}
                defaultValue={s.loyaltyVolumeDiscountBps / 100}
              />
            </Field>
            <Field label="Streak weeks" hint="Consecutive pickup weeks">
              <input
                name="loyaltyStreakWeeks"
                type="number"
                min={1}
                defaultValue={s.loyaltyStreakWeeks}
              />
            </Field>
            <Field label="Streak discount (%)" hint="Applied after volume discount">
              <input
                name="loyaltyStreakDiscountPercent"
                type="number"
                min={0}
                max={100}
                step={1}
                defaultValue={s.loyaltyStreakDiscountBps / 100}
              />
            </Field>
            <Field
              label="Cashback per ₱100"
              hint="Pesos earned per ₱100 of product spend after discounts"
            >
              <input
                name="loyaltyCashbackPer100Pesos"
                type="number"
                min={0}
                step={0.5}
                defaultValue={s.loyaltyCashbackPer100Centavos / 100}
              />
            </Field>
          </div>
        </Card>

        <Card className="grid gap-4 p-5">
          <h2 className="font-display text-xl">VAT</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="vatRegistered" defaultChecked={s.vatRegistered} />
            VAT registered
          </label>
          <Field label="Mode">
            <select name="vatMode" defaultValue={s.vatMode}>
              <option value="none">None</option>
              <option value="inclusive">Inclusive (shelf price includes VAT)</option>
              <option value="exclusive">Exclusive (add 12% on top)</option>
            </select>
          </Field>
        </Card>

        <SubmitButton>Save settings</SubmitButton>
      </form>
    </div>
  );
}
