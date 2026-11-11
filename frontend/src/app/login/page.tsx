"use client";

import { Suspense } from "react";
import AuthCard from "@/components/AuthCard";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <AuthCard mode="login" />
    </Suspense>
  );
}
