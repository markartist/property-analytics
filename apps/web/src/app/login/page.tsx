import { Suspense } from "react";
import Script from "next/script";
import { Loader2 } from "lucide-react";
import LoginClient from "./login-client";
import {
  CLOUDFLARE_BOOTSTRAP_MARKER,
  CLOUDFLARE_LOGGED_OUT_STORAGE_KEY,
  LOGGED_OUT_MARKER,
} from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";
const BOOTSTRAP_URL = new URL("/v1/auth/access-bootstrap", API_BASE).toString();

function buildBootstrapRedirectScript() {
  return `
    (function () {
      try {
        var params = new URLSearchParams(window.location.search);
        if (
          window.location.pathname === "/login" &&
          !params.get("error") &&
          !params.get("${CLOUDFLARE_BOOTSTRAP_MARKER}") &&
          !params.get("${LOGGED_OUT_MARKER}") &&
          window.sessionStorage.getItem("${CLOUDFLARE_LOGGED_OUT_STORAGE_KEY}") !== "1"
        ) {
          window.location.replace("${BOOTSTRAP_URL}?next=%2Fpond%3F${CLOUDFLARE_BOOTSTRAP_MARKER}%3D1");
        }
      } catch (error) {
        console.warn("Data Pond login bootstrap redirect failed", error);
      }
    })();
  `;
}

export default function LoginPage() {
  return (
    <>
      <Script id="login-bootstrap-redirect" strategy="beforeInteractive">
        {buildBootstrapRedirectScript()}
      </Script>
      <Suspense
        fallback={
          <div
            className="flex min-h-screen items-center justify-center"
            style={{ background: "linear-gradient(135deg, #15284B 0%, #0D5E6D 50%, #15803D 100%)" }}
          >
            <Loader2 className="h-8 w-8 animate-spin text-white/50" />
          </div>
        }
      >
        <LoginClient />
      </Suspense>
    </>
  );
}
