import { useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  error: Error;
  reset?: () => void;
}

export function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  const router = useRouter();

  const handleReset = () => {
    if (reset) {
      reset();
    } else {
      router.invalidate();
    }
  };

  return (
    <div className="min-h-screen bg-[#090909] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#0e0e0e] border border-[#343434] rounded-lg p-6 space-y-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
          <p className="text-gray-400 text-sm">
            An error occurred while loading this page.
          </p>
        </div>

        <div className="bg-[#1a1a1a] border border-[#343434] rounded p-4">
          <p className="text-red-400 text-sm font-mono break-words">
            {error.message}
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleReset}
            className="flex-1 bg-[#242424] hover:bg-[#2a2a2a] text-white border border-[#343434]"
          >
            Try again
          </Button>
          <Button
            onClick={() => router.navigate({ to: "/" })}
            variant="outline"
            className="flex-1 border-[#343434] text-white hover:bg-[#242424]"
          >
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
}
