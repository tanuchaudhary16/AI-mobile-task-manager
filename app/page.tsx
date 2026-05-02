import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="card">
        <span className="badge">Mini Task Management System</span>
        <h1>Track daily work from a Google Sheet.</h1>
        <p className="hero-copy">
          Open the member view with a URL like <code>/member?name=Alice</code> to see only today's tasks for that
          teammate.
        </p>
        <Link className="primary-button" href="/member?name=Alice">
          Open sample member view
        </Link>
      </section>
    </main>
  );
}
