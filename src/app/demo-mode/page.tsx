import Link from "next/link";

export default function DemoModePage() {
  return (
    <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-[#1f2933]">
      <div className="mx-auto max-w-3xl rounded-lg border border-[#e4ded4] bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#b42318]">
          Demo Mode
        </p>
        <h1 className="mt-3 text-3xl font-bold">Offline pitch safety net</h1>
        <p className="mt-4 text-sm leading-6 text-[#52616f]">
          Set <code>SMART_CLERK_DEMO_MODE=true</code> to force seeded local fixtures. Without
          Google Sheets credentials, the app automatically falls back to local demo data and keeps
          the dashboard usable.
        </p>
        <Link
          className="mt-6 inline-flex rounded-md bg-[#b42318] px-4 py-2 text-sm font-semibold text-white"
          href="/"
        >
          Open command center
        </Link>
      </div>
    </main>
  );
}
