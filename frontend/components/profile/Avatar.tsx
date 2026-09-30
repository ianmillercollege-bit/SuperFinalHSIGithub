export const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';

// Round avatar: the uploaded picture, or initials. Decorative: the name is always next to it.
export default function AvatarCircle({ name, src, size = 34, className = 'cq-avatar' }: { name: string; src?: string | null; size?: number; className?: string }) {
  return (
    <span className={className} style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }} aria-hidden="true">
      {src ? <img src={src} alt="" /> : initialsOf(name)}
    </span>
  );
}
