'use client';

import { ErrorNotice, Loading } from '@/components/LoadState';
import { useCoachContext } from '../../lib/coach/session';
import CoachPage from './CoachPage';

/** /coach: the kit's coach page on the dashboard's numbers. The layout supplies the frame, sidebar and the one "Sample data" badge. */
export default function CoachRoute() {
  const { ready, error, ...session } = useCoachContext();
  if (!ready) return <Loading what="the coach" />;
  // The coach quotes the same live figures as the screens, so it does not answer from sample numbers when they are missing.
  if (error !== undefined) return <ErrorNotice error={error} onRetry={() => window.location.reload()} />;
  return <CoachPage {...session} planHref="/dashboard" />;
}
