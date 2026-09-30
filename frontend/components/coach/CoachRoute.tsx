'use client';

import { Loading } from '@/components/LoadState';
import { useCoachContext } from '../../lib/coach/session';
import CoachPage from './CoachPage';

/** /coach: the kit's coach page on the dashboard's numbers. The layout supplies the frame, sidebar and the one "Sample data" badge. */
export default function CoachRoute() {
  const { ready, ...session } = useCoachContext();
  if (!ready) return <Loading what="the coach" />;
  return <CoachPage {...session} planHref="/dashboard" />;
}
