import Dashboard from "./dashboard";

export const dynamic = 'force-dynamic';

export default function Page() {
  // Safe environment variable retrieval
  const getApiUrl = () => {
    console.log("🔍 Server-Side Env Check:");
    console.log("API_URL:", process.env.API_URL);
    console.log("NEXT_PUBLIC_API_URL:", process.env.NEXT_PUBLIC_API_URL);
    console.log("Bracket NEXT_PUBLIC:", process.env['NEXT_PUBLIC_API_URL']);

    // Prioritize API_URL (runtime) over NEXT_PUBLIC_API_URL (build-time/inlined)
    let url = process.env.API_URL || process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3001';

    if (url && !url.startsWith('http')) {
      url = `https://${url}`;
    }
    console.log("✅ Resolved API URL:", url);
    return url;
  };

  const apiUrl = getApiUrl();
  console.log("Runtime Client API URL:", apiUrl); // Log for server-side debugging

  return <Dashboard apiUrl={apiUrl} />;
}
