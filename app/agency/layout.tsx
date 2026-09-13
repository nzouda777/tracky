import { AppShell, type NavItem } from "@/components/app-shell";
import { requireAgency } from "@/lib/auth/session";

const NAV: NavItem[] = [
  { href: "/agency", label: "Active deliveries" },
  { href: "/agency/completed", label: "Completed" },
];

export default async function AgencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAgency();

  return (
    <AppShell session={session} nav={NAV} areaLabel="Dispatch">
      {children}
    </AppShell>
  );
}
