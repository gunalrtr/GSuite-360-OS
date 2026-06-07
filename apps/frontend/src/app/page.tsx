"use client";

import { useEffect } from "react";

export default function IndexPage() {
  useEffect(() => {
    const user = localStorage.getItem("gsuite_user");
    if (user) {
      window.location.href = "/dashboard";
    } else {
      window.location.href = "/login";
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#090d16] flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>
  );
}
