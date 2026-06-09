export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <header className="mb-10 text-center">
        <p className="smallcaps text-ink-faint mb-3">est. tonight, among friends</p>
        <h1 className="font-display text-5xl sm:text-6xl font-semibold tracking-tight">
          Commonplace
        </h1>
        <p className="commentary italic text-ink-soft mt-4 max-w-sm mx-auto">
          A shared notebook of everything you&rsquo;re reading, watching, and
          listening to.
        </p>
      </header>
      <main className="w-full max-w-sm">{children}</main>
      <div className="fleuron-rule w-full max-w-sm mt-10">
        <span aria-hidden>&#10087;</span>
      </div>
    </div>
  );
}
