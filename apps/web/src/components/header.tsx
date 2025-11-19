"use client";
import { orpc } from "@/utils/orpc";
import { useQuery } from "@tanstack/react-query";
import { ModeToggle } from "./mode-toggle";

export default function Header() {
  const apiHealthcheck = useQuery(orpc.health.queryOptions());
  const isConnected = apiHealthcheck.data === "OK";

  return (
    <div>
      <div className="flex flex-row items-center justify-between px-6 py-3">
        <h1 className="text-xl font-semibold">intents data dashboard</h1>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-sm">
              {apiHealthcheck.isLoading
                ? "Checking..."
                : isConnected
                ? "Connected"
                : "Disconnected"}
            </span>
          </div>
          <ModeToggle />
        </div>
      </div>
      <hr />
    </div>
  );
}
