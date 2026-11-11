import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl font-semibold">Sign in</h1>
        </CardTitle>
        <CardDescription>
          JupiGenio is invitation-only. Use the email address your organization invited.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* The form reads ?next= from the URL, which is request-time data. */}
        <Suspense fallback={<Skeleton className="h-56 w-full" />}>
          <LoginForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
