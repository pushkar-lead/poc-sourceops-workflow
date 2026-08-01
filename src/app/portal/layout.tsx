import { StoreHydrator } from "@/components/layout/store-hydrator";
import { Toaster } from "sonner";

// External-facing portal routes (supplier RFQ, buyer quote acceptance) intentionally render
// bare — no sidebar/app chrome. But they still read from the same Zustand store as the internal
// console, and persist uses skipHydration, so without this the store silently falls back to
// freshSeed() defaults on every cold navigation (exactly how a real emailed portal link opens),
// making any quote/invite created during a live session invisible here.
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StoreHydrator />
      {children}
      <Toaster richColors position="top-right" />
    </>
  );
}
