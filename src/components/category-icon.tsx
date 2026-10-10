import {
  BrickWall,
  Building2,
  ClipboardList,
  Flame,
  Grid2x2,
  Hammer,
  HardHat,
  Layers,
  Paintbrush,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { skillById } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const BY_CATEGORY: Record<string, LucideIcon> = {
  general: HardHat,
  masonry: BrickWall,
  rcc: Layers,
  finishing: Grid2x2,
  painting: Paintbrush,
  waterproof: Building2,
  mep: Wrench,
  skilled: Hammer,
  earthwork: Truck,
  operators: Truck,
  professionals: ClipboardList,
  contractors: Flame,
};

export function CategoryIcon({
  id,
  className,
}: {
  id: string;
  className?: string;
}) {
  const skill = skillById(id);
  const Icon = BY_CATEGORY[id] ?? (skill ? BY_CATEGORY[skill.categoryId] : undefined) ?? HardHat;
  return <Icon className={cn("size-5", className)} strokeWidth={1.75} />;
}
