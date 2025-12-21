import { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface MasonryGridProps {
  children?: ReactNode;
  isLoading?: boolean;
  skeletonCount?: number;
}

// Skeleton card component for loading state
function ArticleCardSkeleton({ variant = "medium" }: { variant?: "large" | "medium" | "small" }) {
  return (
    <div
      className={cn(
        "bg-card text-card-foreground rounded-xl border border-border/50 overflow-hidden shadow-sm mb-6 break-inside-avoid flex flex-col"
      )}
    >
      {/* Large Card Image Skeleton */}
      {variant === "large" && (
        <Skeleton className="aspect-video w-full" />
      )}

      <div className={cn("p-5 flex flex-col gap-3", variant === "large" ? "p-6" : "")}>
        {/* Medium Card with Thumbnail */}
        {variant === "medium" && (
          <div className="flex gap-4 mb-2">
            <Skeleton className="h-20 w-20 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          </div>
        )}

        {/* Title Skeleton for Large and Small variants */}
        {variant !== "medium" && (
          <div className="space-y-2">
            <Skeleton className={cn("h-6 w-full", variant === "large" && "h-8")} />
            <Skeleton className={cn("h-6 w-3/4", variant === "large" && "h-8")} />
          </div>
        )}

        {/* Excerpt Skeleton for Large variant */}
        {variant === "large" && (
          <div className="space-y-2 mt-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {/* Excerpt Skeleton for Medium variant */}
        {variant === "medium" && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        )}

        {/* Metadata Footer Skeleton */}
        <div className="flex items-center justify-between mt-auto pt-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-2.5 w-2.5 rounded-full" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Generate skeleton cards with varied sizes for visual interest
function SkeletonCards({ count }: { count: number }) {
  const variants: Array<"large" | "medium" | "small"> = ["large", "medium", "small", "medium", "small", "medium"];
  
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <ArticleCardSkeleton 
          key={`skeleton-${index}`} 
          variant={variants[index % variants.length]} 
        />
      ))}
    </>
  );
}

export function MasonryGrid({ children, isLoading = false, skeletonCount = 6 }: MasonryGridProps) {
  return (
    <div className="masonry-grid w-full">
      {isLoading ? (
        <SkeletonCards count={skeletonCount} />
      ) : (
        children
      )}
    </div>
  );
}

export { ArticleCardSkeleton };
