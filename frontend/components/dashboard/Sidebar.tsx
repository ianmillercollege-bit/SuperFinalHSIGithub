'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AvatarCircle from '../profile/Avatar';

export interface NavItem { label: string; href?: string; badge?: string | number }
export interface NavGroup { title: string; tone?: 'default' | 'claims'; items: NavItem[] }
export interface SidebarProps {
  groups: NavGroup[];
  user: { name: string; role: string; business: string; avatarUrl?: string | null };
  profileHref?: string;       // when set, the user chip becomes a link to the profile page
  backend: { state: 'online' | 'offline' | 'waking' | 'notConfigured'; label: string };
  onSignOut?: () => void;     // omit when the app has no sign-out
  logoSrc?: string;           // default /brand/cirqo-logo.png
}

export default function Sidebar({ groups, user, profileHref, backend, onSignOut, logoSrc = '/brand/cirqo-logo.png' }: SidebarProps) {
  const pathname = usePathname();
  const isActive = (href?: string) => !!href && (pathname === href || pathname.startsWith(href + '/'));

  const renderItem = (it: NavItem, claims: boolean) => {
    const active = isActive(it.href);
    const cls = `cq-nav-item${active ? ' is-active' : ''}${it.href ? '' : ' is-disabled'}`;
    const inner = (
      <>
        <span className="cq-nav-inner">
          {active && !claims && <span className="cq-nav-dot" aria-hidden="true" />}
          {it.label}
        </span>
        {it.badge !== undefined && <span className="cq-badge">{it.badge}</span>}
      </>
    );
    return it.href
      ? <Link key={it.label} className={cls} href={it.href} aria-current={active ? 'page' : undefined}>{inner}</Link>
      : <span key={it.label} className={cls} aria-disabled="true">{inner}</span>;
  };

  return (
    <aside className="cq-sidebar" id="cq-sidebar" aria-label="Main navigation">
      <div className="cq-lockup">
        <Image src={logoSrc} alt="CIRQO Analytics logo" width={192} height={58} priority />
        <span className="cq-lockup-sub" aria-hidden="true">ANALYTICS</span>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {groups.map((g) => g.tone === 'claims' ? (
          <div key={g.title} className="cq-claims">
            <span className="cq-claims-title">{g.title}</span>
            {g.items.map((it) => renderItem(it, true))}
          </div>
        ) : (
          <div key={g.title} className="cq-nav-group">
            <span className="cq-nav-label">{g.title}</span>
            {g.items.map((it) => renderItem(it, false))}
          </div>
        ))}
      </nav>
      <div className="cq-side-foot">
        {(() => {
          const chip = (
            <>
              <AvatarCircle name={user.name} src={user.avatarUrl} />
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                <span className="cq-user-name">{user.name}</span>
                <span className="cq-user-role">{user.role} · {user.business}</span>
              </div>
              {profileHref && <span className="cq-user-go" aria-hidden="true">›</span>}
            </>
          );
          return profileHref
            ? <Link href={profileHref} className={`cq-user is-link${isActive(profileHref) ? ' is-active' : ''}`} aria-label={`Open your profile, ${user.name}`} aria-current={isActive(profileHref) ? 'page' : undefined}>{chip}</Link>
            : <div className="cq-user">{chip}</div>;
        })()}
        <div className="cq-status">
          <span className="cq-status-l">
            <span className={`cq-dot${backend.state === 'offline' ? ' is-offline' : backend.state === 'online' ? '' : ' is-waking'}`} aria-hidden="true" />
            {backend.label}
          </span>
          {onSignOut && <button type="button" className="cq-linkbtn" onClick={onSignOut}>Sign out</button>}
        </div>
      </div>
    </aside>
  );
}
