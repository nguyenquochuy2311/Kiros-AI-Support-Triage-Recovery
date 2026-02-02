import Dashboard from "./dashboard";

export default function Page() {
  // Safe environment variable retrieval
  const getApiUrl = () => {
    let url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    if (url && !url.startsWith('http')) {
      url = `https://${url}`;
    }
    return url;
  };

  const apiUrl = getApiUrl();
  console.log("Runtime Client API URL:", apiUrl); // Log for server-side debugging

  return <Dashboard apiUrl={apiUrl} />;
}
