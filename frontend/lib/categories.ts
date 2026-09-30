// Product categories. Source: BACKEND_CONTRACT.md v1.4.1, section 7c: "Product gains category:
// headphones | laptops | phones_tablets | computer_hardware". Change only when the contract changes.
export const PRODUCT_CATEGORIES = [
  { value: "headphones", label: "Headphones" },
  { value: "laptops", label: "Laptops" },
  { value: "phones_tablets", label: "Phones and tablets" },
  { value: "computer_hardware", label: "Computer hardware" },
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]["value"];

export function categoryLabel(value: string): string {
  return PRODUCT_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}
