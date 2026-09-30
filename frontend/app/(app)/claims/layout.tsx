// Every claims page gets the 4px orange top edge. The root layout (sidebar,
// data badge) is unchanged.
export default function ClaimsLayout({ children }: LayoutProps<"/claims">) {
  return <div className="claims-area">{children}</div>;
}
