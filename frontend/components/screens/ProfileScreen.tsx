"use client";

import ProfilePage from "@/components/profile/ProfilePage";
import { PROFILE_KEY, useProfileDefaults } from "@/lib/profile/defaults";

/** /profile: the kit's profile page. The layout supplies the frame, sidebar and the one "Sample data" badge. */
export default function ProfileScreen() {
  return <ProfilePage profileKey={PROFILE_KEY} defaults={useProfileDefaults()} />;
}
