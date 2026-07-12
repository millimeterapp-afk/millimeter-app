import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Sprječava clickjacking — app se ne može staviti u tuđi iframe
          { key: "X-Frame-Options", value: "DENY" },
          // Sprječava MIME-sniffing napade
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Ne curi puni URL na eksterne linkove
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Ograničava pristup senzorima/kameri (nema potrebe u ovoj app)
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Osnovni CSP — dozvoljava self + Supabase + inline (Next zahtijeva), blokira strane iframe-ove
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co https://api.gocreate.nu wss://*.supabase.co",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
