import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/analytics/events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();

          console.log("[Analytics Event]", {
            timestamp: new Date().toISOString(),
            ...body,
          });

          return Response.json({ success: true });
        } catch (error) {
          console.error("Error processing analytics event:", error);
          return Response.json(
            { error: "Failed to process event" },
            { status: 500 }
          );
        }
      },
    },
  }
});
