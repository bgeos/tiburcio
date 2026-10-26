import { DemoDataNotice } from "@/components/demo-data-notice";
import { PrototypeNav } from "./prototype-nav";
import { PrototypeStoreProvider } from "./prototype-store";

/** Shares the prototype's demo state between its pages (D-019). */
export default function PrototypeLayout({ children }: { children: React.ReactNode }) {
  return (
    <PrototypeStoreProvider>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DemoDataNotice>Prototype with fictional demo data. Changes aren&apos;t saved and reset when you reload.</DemoDataNotice>
        <PrototypeNav />
      </div>
      {children}
    </PrototypeStoreProvider>
  );
}
