import { requireStaff } from "@/lib/auth";
import { AdminNav } from "@/components/admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();

  return (
    <div className="flex min-h-dvh flex-col md:h-dvh md:flex-row md:overflow-hidden">
      <AdminNav userName={user.name} />
      <div className="min-w-0 flex-1 md:overflow-y-auto">
        <div className="shell max-w-6xl py-4 pb-[max(1.75rem,env(safe-area-inset-bottom))] md:py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
