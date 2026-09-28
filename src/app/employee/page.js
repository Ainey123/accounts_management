"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EmployeeRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-300">
      <div className="flex items-center space-x-3">
        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <span>Redirecting to Employee Portal...</span>
      </div>
    </div>
  );
}
