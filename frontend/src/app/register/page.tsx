"use client";

import { Suspense } from "react";
import AuthCard from "@/components/AuthCard";

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <AuthCard mode="register" />
    </Suspense>
  );
}
