import type { ReactNode } from "react";
import { APP_URL } from "../lib/config";

export const Spinner = () => <span className="spinner" aria-label="Loading" />;

export function Button({ children, kind = "primary", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: "primary" | "ghost" }) {
  return (
    <button {...props} className={`btn ${kind === "ghost" ? "btn-ghost" : ""} ${props.className ?? ""}`}>
      {children}
    </button>
  );
}

export function Card({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      {(title || action) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// Links open Offerwing in a new tab.
export const AppLink = ({ path, children }: { path: string; children: ReactNode }) => (
  <a className="link" href={`${APP_URL}${path}`} target="_blank" rel="noreferrer">
    {children}
  </a>
);

export const scoreClass = (n: number) => (n >= 70 ? "score good" : n >= 50 ? "score mid" : "score low");

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "warn"; children: ReactNode }) {
  return <p className={`notice ${tone}`}>{children}</p>;
}
