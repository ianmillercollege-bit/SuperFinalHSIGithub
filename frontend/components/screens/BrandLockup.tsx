import Image from 'next/image';

// Logo + "ANALYTICS". Use only on navy surfaces (the logo image has the navy background baked in).
export default function BrandLockup({ large, src = '/brand/cirqo-logo.png' }: { large?: boolean; src?: string }) {
  const w = large ? 340 : 192;
  return (
    <div className={`cq-lockup${large ? ' cq-lockup-lg' : ''}`} style={{ padding: 0 }}>
      <Image src={src} alt="CIRQO Analytics logo" width={w} height={Math.round((w * 229) / 759)} priority />
      <span className="cq-lockup-sub" aria-hidden="true">ANALYTICS</span>
    </div>
  );
}
