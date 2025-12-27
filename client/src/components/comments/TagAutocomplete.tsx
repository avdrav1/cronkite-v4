import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { User, AtSign, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";

interface TagSuggestion {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

interface TagSuggestionsResponse {
  success: boolean;
  suggestions: TagSuggestion[];
}

interface TagAutocompleteProps {
  query: string;
  currentUserId: string;
  position: { top: number; left: number };
  onTagSelect: (username: string) => void;
  onClose: () => void;
}

export function TagAutocomplete({ 
  query, 
  currentUserId, 
  position, 
  onTagSelect, 
  onClose 
}: TagAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: suggestionsData, isLoading } = useQuery<TagSuggestionsResponse>({
    queryKey: ['/api/users/search', { q: query, limit: 10 }],
    enabled: query.length > 0,
    staleTime: 10000, // 10 seconds
  });

  const suggestions = suggestionsData?.suggestions || [];

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!suggestions.length) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (suggestions[selectedIndex]) {
            onTagSelect(suggestions[selectedIndex].username);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [suggestions, selectedIndex, onTagSelect, onClose]);

  // Handle clicks outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (isLoading) {
    return (
      <div
        ref={containerRef}
        className="fixed z-50 w-64"
        style={{ top: position.top, left: position.left }}
      >
        <Card className="shadow-lg border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Searching friends...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!suggestions.length) {
    return (
      <div
        ref={containerRef}
        className="fixed z-50 w-64"
        style={{ top: position.top, left: position.left }}
      >
        <Card className="shadow-lg border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AtSign className="h-4 w-4" />
              <span>No friends found</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed z-50 w-64"
      style={{ top: position.top, left: position.left }}
    >
      <Card className="shadow-lg border">
        <CardContent className="p-0">
          <ScrollArea className="max-h-48">
            <div className="p-1">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.userId}
                  className={`w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors ${
                    index === selectedIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent/50'
                  }`}
                  onClick={() => onTagSelect(suggestion.username)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={suggestion.avatarUrl} alt={suggestion.displayName} />
                    <AvatarFallback>
                      <User className="h-3 w-3" />
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {suggestion.displayName}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      @{suggestion.username}
                    </div>
                  </div>
                  
                  <AtSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          </ScrollArea>
          
          <div className="border-t p-2 text-xs text-muted-foreground text-center">
            Use ↑↓ to navigate, Enter to select, Esc to close
          </div>
        </CardContent>
      </Card>
    </div>
  );
}