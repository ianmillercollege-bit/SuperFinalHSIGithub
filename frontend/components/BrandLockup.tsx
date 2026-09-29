import fs from "node:fs";
import path from "node:path";
import Image from "next/image";

// The logo PNG has a navy background baked in: use this only on navy surfaces
// (the sidebar). Until public/brand/cirqo-logo.png is added, a text
// placeholder shows instead; the image appears automatically on the next build.
const LOGO_SRC = "/brand/cirqo-logo.png";
const LOGO_W = 759;
const LOGO_H = 229;
const hasLogo = fs.existsSync(path.join(process.cwd(), "public", "brand", "cirqo-logo.png"));

export default function BrandLockup({ width }: { width: number }) {
  return (
    <div className="lockup" style={{ width }}>
      {hasLogo ? (
        <Image
          src={LOGO_SRC}
          alt="CIRQO Analytics logo"
          width={width}
          height={Math.round((width * LOGO_H) / LOGO_W)}
          style={{ width, height: "auto" }}
          priority
        />
      ) : (
        <span className="brand-text lockup-placeholder">CIRQO</span>
      )}
      <span
        className="brand-text lockup-analytics"
        style={{ paddingLeft: Math.round(width * 0.34) }}
        aria-hidden={hasLogo}
      >
        Analytics
      </span>
    </div>
  );
}
