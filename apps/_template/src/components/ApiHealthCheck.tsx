import { useQuery } from "@tanstack/react-query";
import { orpc } from "../utils/orpc";

export function ApiHealthCheck() {
  const { data, isLoading, error } = useQuery(orpc.health.queryOptions());

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-2 border rounded-md">
        <div className="h-3 w-3 rounded-full bg-yellow-400 animate-pulse"></div>
        <span className="text-sm text-muted-foreground">Checking API...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-2 border border-destructive/50 rounded-md bg-destructive/10">
        <div className="h-3 w-3 rounded-full bg-red-500"></div>
        <span className="text-sm text-destructive">
          API Error: {error.message}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-2 border border-green-300 bg-green-50 rounded-md">
      <div className="h-3 w-3 rounded-full bg-green-500"></div>
      <span className="text-sm text-green-800">✅ API Status: {data}</span>
    </div>
  );
}
