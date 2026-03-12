"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Something went wrong</h2>
          <p className="text-sm text-gray-500">{error.message}</p>
          <button
            onClick={reset}
            className="px-4 py-2 text-sm bg-forge-600 text-white rounded hover:bg-forge-700"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
