import { BUSINESS } from "@/lib/business";

/** Marks a page that runs on the frontend's own sample data about the demo business (DECISIONS.md #28). */
export function SampleTag() {
  return <span className="cq-pill is-neutral is-lg">Sample data · {BUSINESS.name}</span>;
}
