import Dashboard from "./dashboard";

export default function Page() {
  // Safe environment variable retrieval
  const getApiUrl = () => {
    // Prioritize API_URL (runtime) over NEXT_PUBLIC_API_URL (build-time/inlined)
    let url = process.env.API_URL || process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3001';
    if (url && !url.startsWith('http')) {
      url = `https://${url}`;
    }
    return url;
  };

  const apiUrl = getApiUrl();
  console.log("Runtime Client API URL:", apiUrl); // Log for server-side debugging

  return <Dashboard apiUrl={apiUrl} />;
}
