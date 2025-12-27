import { User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TaggedUserProps {
  user: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  variant?: "inline" | "badge" | "avatar";
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
}

export function TaggedUser({ 
  user, 
  variant = "badge", 
  size = "md", 
  showTooltip = true 
}: TaggedUserProps) {
  const sizeClasses = {
    sm: {
      avatar: "h-4 w-4",
      text: "text-xs",
      badge: "text-xs px-1.5 py-0.5"
    },
    md: {
      avatar: "h-6 w-6",
      text: "text-sm",
      badge: "text-sm px-2 py-1"
    },
    lg: {
      avatar: "h-8 w-8",
      text: "text-base",
      badge: "text-sm px-3 py-1.5"
    }
  };

  const renderContent = () => {
    switch (variant) {
      case "inline":
        return (
          <span className={`font-medium text-primary ${sizeClasses[size].text}`}>
            @{user.displayName}
          </span>
        );

      case "avatar":
        return (
          <div className="flex items-center gap-2">
            <Avatar className={sizeClasses[size].avatar}>
              <AvatarImage src={user.avatarUrl} alt={user.displayName} />
              <AvatarFallback>
                <User className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
            <span className={`font-medium ${sizeClasses[size].text}`}>
              {user.displayName}
            </span>
          </div>
        );

      case "badge":
      default:
        return (
          <Badge 
            variant="secondary" 
            className={`bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${sizeClasses[size].badge}`}
          >
            <Avatar className="h-3 w-3 mr-1">
              <AvatarImage src={user.avatarUrl} alt={user.displayName} />
              <AvatarFallback>
                <User className="h-2 w-2" />
              </AvatarFallback>
            </Avatar>
            @{user.displayName}
          </Badge>
        );
    }
  };

  if (showTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-pointer">
              {renderContent()}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={user.avatarUrl} alt={user.displayName} />
                <AvatarFallback>
                  <User className="h-3 w-3" />
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{user.displayName}</div>
                <div className="text-xs text-muted-foreground">Friend</div>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return <>{renderContent()}</>;
}