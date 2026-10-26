import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/dal/auth";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Your profile" };

/** The signed-in person's own name and appearance (D-027). Same in every organization. */
export default function ProfilePage() {
  return (
    <>
      <PageHeader
        title="Your profile"
        description="Your name as others see it, and how JupiGenio looks for you on every device."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full max-w-xl" aria-label="Loading your profile" />}>
        <ProfileContent />
      </Suspense>
    </>
  );
}

async function ProfileContent() {
  const user = await requireUser();
  return <ProfileForm email={user.email} fullName={user.fullName} accentColor={user.accentColor} themeMode={user.themeMode} />;
}
