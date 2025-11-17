import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Profile } from "../../components/Profile";
import { ApiHealthCheck } from "../../components/ApiHealthCheck";
import { getProfile } from "../../lib/social";

export const Route = createFileRoute("/_layout/")({
  loader: async () => {
    const accountId = "efiz.near";
    const profile = await getProfile(accountId);
    return { accountId, profile };
  },
  component: Home,
});

function Home() {
  const { accountId, profile } = Route.useLoaderData();

  if (!profile) {
    return (
      <div className="p-8 text-center text-xl text-red-500">
        Profile not found for {accountId}
        <div className="mt-4">
          <ApiHealthCheck />
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Debug overlay in bottom-right corner */}
      <div className="fixed bottom-4 left-4 z-10">
        <ApiHealthCheck />
      </div>
      <Profile profile={profile} accountId={accountId} />
    </div>
  );
}
