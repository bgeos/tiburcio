import type { Metadata } from "next";
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
          Use the email address your organization invited.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  );
}
