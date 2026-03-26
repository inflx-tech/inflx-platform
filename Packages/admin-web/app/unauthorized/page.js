export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="text-center">
        <div className="text-4xl mb-4">🚫</div>
        <h1 className="font-display text-xl font-bold text-t1 mb-2">Access Denied</h1>
        <p className="text-sm text-t3 mb-4">This portal is for INFLX admins only.</p>
        <a href="/login" className="text-sm font-bold text-navy hover:underline">← Back to login</a>
      </div>
    </div>
  );
}
