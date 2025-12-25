import {
  Cpu,
  Briefcase,
  Gamepad2,
  Trophy,
  FlaskConical,
  Rocket,
  Newspaper,
  Film,
  Music,
  BookOpen,
  UtensilsCrossed,
  Plane,
  Code,
  Palette,
  Car,
  Hammer,
  Smartphone,
  Apple,
  Landmark,
  Laugh,
  Sparkles,
  Shirt,
  TrendingUp,
  CircleDot,
  Goal,
  Target,
  Camera,
  Sofa,
  Folder,
  type LucideIcon
} from "lucide-react";

// Category from API response
export interface CategoryFromAPI {
  category: string;
  feedCount: number;
}

// Category with UI metadata
export interface Category {
  id: string;
  label: string;
  icon: LucideIcon;
  feedCount: number;
}

// Icon mapping for known categories (database category name -> icon)
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'Technology': Cpu,
  'Business': Briefcase,
  'Gaming': Gamepad2,
  'Sports': Trophy,
  'Science': FlaskConical,
  'Space': Rocket,
  'News': Newspaper,
  'Entertainment': Film,
  'Music': Music,
  'Books': BookOpen,
  'Food': UtensilsCrossed,
  'Travel': Plane,
  'Programming': Code,
  'Design': Palette,
  'Automotive': Car,
  'DIY': Hammer,
  'Android': Smartphone,
  'Apple': Apple,
  'History': Landmark,
  'Humor': Laugh,
  'Beauty': Sparkles,
  'Fashion': Shirt,
  'Startups': TrendingUp,
  'Cricket': CircleDot,
  'Football': Goal,
  'Tennis': Target,
  'Photography': Camera,
  'Interior': Sofa,
};

// Get icon for a category, with fallback
export function getCategoryIcon(categoryName: string): LucideIcon {
  return CATEGORY_ICONS[categoryName] || Folder;
}

// Transform API categories to UI categories
export function transformCategories(apiCategories: CategoryFromAPI[]): Category[] {
  return apiCategories.map(cat => ({
    id: cat.category, // Use the database category name as ID
    label: cat.category,
    icon: getCategoryIcon(cat.category),
    feedCount: cat.feedCount
  }));
}

// Legacy exports for backward compatibility (will be removed)
export const CATEGORIES: Category[] = [];

export function getCategoryById(id: string): Category | undefined {
  return undefined;
}

export function getCategoriesByIds(ids: string[]): Category[] {
  return [];
}
