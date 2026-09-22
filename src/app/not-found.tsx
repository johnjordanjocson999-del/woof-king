import Link from "next/link";

export default function NotFound() {
  return (
    <div className="shell grid min-h-[60dvh] place-content-center gap-4 py-20 text-center">
      <p className="eyebrow">404</p>
      <h1 className="text-[2.4rem] leading-[1]">Nothing baking here</h1>
      <p className="muted text-sm">That page is not on this week&apos;s table.</p>
      <Link href="/" className="btn btn-primary justify-self-center">
        Back home
      </Link>
    </div>
  );
}
