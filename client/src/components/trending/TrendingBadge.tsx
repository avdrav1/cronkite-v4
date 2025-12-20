import { Flame } from "lucide-react";

export function TrendingBadge() {
  return (
    <div className="inline-flex items-center gap-1 bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-orange-500/20">
      <Flame className="h-3 w-3 fill-orange-500" />
      Trending
    </div>
  );
}
