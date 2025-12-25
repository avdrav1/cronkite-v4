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
  type LucideIcon
} from "lucide-react";

export interface Category {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

export const CATEGORIES: Category[] = [
  { id: 'tech', label: 'Technology', icon: Cpu, description: 'Tech news, gadgets, and innovation' },
  { id: 'business', label: 'Business', icon: Briefcase, description: 'Markets, finance, and economy' },
  { id: 'gaming', label: 'Gaming', icon: Gamepad2, description: 'Video games, esports, and reviews' },
  { id: 'sports', label: 'Sports', icon: Trophy, description: 'All sports coverage and scores' },
  { id: 'science', label: 'Science', icon: FlaskConical, description: 'Research, discoveries, and breakthroughs' },
  { id: 'space', label: 'Space', icon: Rocket, description: 'Space exploration and astronomy' },
  { id: 'news', label: 'World News', icon: Newspaper, description: 'Breaking news and current events' },
  { id: 'movies', label: 'Entertainment', icon: Film, description: 'Movies, TV, and streaming' },
  { id: 'music', label: 'Music', icon: Music, description: 'Artists, albums, and concerts' },
  { id: 'books', label: 'Books', icon: BookOpen, description: 'Literature, reviews, and authors' },
  { id: 'food', label: 'Food', icon: UtensilsCrossed, description: 'Recipes, restaurants, and cuisine' },
  { id: 'travel', label: 'Travel', icon: Plane, description: 'Destinations and travel guides' },
  { id: 'programming', label: 'Programming', icon: Code, description: 'Development, tutorials, and tools' },
  { id: 'design', label: 'Design', icon: Palette, description: 'UI/UX, graphics, and creativity' },
  { id: 'cars', label: 'Automotive', icon: Car, description: 'Cars, EVs, and motorsports' },
  { id: 'diy', label: 'DIY', icon: Hammer, description: 'Projects, crafts, and how-tos' },
  { id: 'android', label: 'Android', icon: Smartphone, description: 'Android news and apps' },
  { id: 'apple', label: 'Apple', icon: Apple, description: 'Apple products and ecosystem' },
  { id: 'history', label: 'History', icon: Landmark, description: 'Historical events and stories' },
  { id: 'funny', label: 'Humor', icon: Laugh, description: 'Comedy and entertainment' },
  { id: 'beauty', label: 'Beauty', icon: Sparkles, description: 'Skincare, makeup, and wellness' },
  { id: 'fashion', label: 'Fashion', icon: Shirt, description: 'Style, trends, and clothing' },
  { id: 'startups', label: 'Startups', icon: TrendingUp, description: 'Entrepreneurship and funding' },
  { id: 'cricket', label: 'Cricket', icon: CircleDot, description: 'Cricket matches and news' },
  { id: 'football', label: 'Football', icon: Goal, description: 'Soccer/football worldwide' },
  { id: 'tennis', label: 'Tennis', icon: Target, description: 'Tennis tournaments and players' },
  { id: 'photography', label: 'Photography', icon: Camera, description: 'Photos, gear, and techniques' },
  { id: 'interior', label: 'Interior', icon: Sofa, description: 'Home decor and design' },
];

// Helper to get category by ID
export function getCategoryById(id: string): Category | undefined {
  return CATEGORIES.find(cat => cat.id === id);
}

// Helper to get categories by IDs
export function getCategoriesByIds(ids: string[]): Category[] {
  return CATEGORIES.filter(cat => ids.includes(cat.id));
}
