"use client";

import Link from "next/link";
import { useCallback } from "react";
import SampleNote from "@/components/screens/CommunitySampleNote";
import { getCommunityImpact } from "@/lib/api";
import { useBrandSession } from "@/lib/auth/brandSession";
import { useUserSession } from "@/lib/auth/userSession";
import { BUSINESS } from "@/lib/business";
import { formatPercent } from "@/lib/format";
import { useApi } from "@/lib/useApi";

/** The dashboard's Community impact tile = GET /community/impact?brandId= (contract v1.6, section 7e). */
export default function CommunityImpactTile() {
  const { user } = useUserSession();
  const brandId = useBrandSession()?.brandId ?? BUSINESS.id;
  const impact = useApi(useCallback(() => getCommunityImpact(brandId), [brandId]));
  if (user?.partner || user?.staff) return null;
  // An error here must not hide the dashboard: the tile just says it could not load.
  if (impact.error !== undefined) return <p className="muted small">Community impact could not be loaded right now.</p>;
  if (!impact.data) return null;
  const d = impact.data.data;
  const share = d.unitsPledged > 0 ? d.unitsPlaced / d.unitsPledged : 0;
  return (
    <section className="card stack" aria-labelledby="community-impact">
      <div className="filters">
        <h2 className="grow" id="community-impact">
          Community impact
        </h2>
        <Link className="button" href="/community/requests">
          {d.requestsPending > 0 ? `Review ${d.requestsPending} waiting` : "See requests"}
        </Link>
      </div>
      {impact.data.sample && <SampleNote />}
      {d.unitsPledged === 0 ? (
        <p className="muted">No units pledged yet. Pledged surplus and refurbished units reach schools and nonprofits through the Community catalog.</p>
      ) : (
        <>
          <div className="stat-grid">
            <div className="card stat">
              <p className="eyebrow">Units placed</p>
              <p className="big-number">
                {d.unitsPlaced} of {d.unitsPledged}
              </p>
              <p className="muted small">{formatPercent(share)} of what you pledged</p>
            </div>
            <div className="card stat">
              <p className="eyebrow">Partners served</p>
              <p className="big-number">{d.partnersServed}</p>
              <p className="muted small">Organizations with an approved request</p>
            </div>
            <div className="card stat">
              <p className="eyebrow">Waiting for you</p>
              <p className="big-number">{d.requestsPending}</p>
              <p className="muted small">Requests to approve or reject</p>
            </div>
          </div>
          <div className="bar-track" aria-hidden>
            <div className="bar-fill" style={{ width: `${Math.round(share * 100)}%` }} />
          </div>
        </>
      )}
    </section>
  );
}
