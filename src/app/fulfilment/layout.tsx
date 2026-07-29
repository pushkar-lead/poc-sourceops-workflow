import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "sonner";

export default function FulfilmentLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppShell>{children}</AppShell>
      <Toaster richColors position="top-right" />
    </>
  );
}
