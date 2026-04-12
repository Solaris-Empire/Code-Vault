import { cn } from "@/lib/utils";

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  bg?: "white" | "off" | "dark" | "green" | "amber";
  id?: string;
}

const bgs = {
  white: "bg-(--color-surface)",
  off: "bg-background",
  dark: "bg-(--brand-dark)",
  green: "bg-(--brand-primary)",
  amber: "bg-(--brand-amber-soft)",
};

export function Section({ children, className, bg = "off", id }: SectionProps) {
  return (
    <section id={id} className={cn("py-16 lg:py-24", bgs[bg], className)}>
      {children}
    </section>
  );
}
