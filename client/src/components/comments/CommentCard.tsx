import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Trash2, User, AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface CommentAuthor {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

interface TaggedUser {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

interface Comment {
  id: string;
  articleId: string;
  content: string;
  author: CommentAuthor;
  taggedUsers: TaggedUser[];
  createdAt: string;
  updatedAt: string;
}

interface CommentCardProps {
  comment: Comment;
  currentUserId: string;
  onCommentDeleted: (commentId: string) => void;
}

export function CommentCard({ comment, currentUserId, onCommentDeleted }: CommentCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const isOwnComment = comment.author.id === currentUserId;
  const commentTime = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await apiRequest('DELETE', `/api/comments/${comment.id}`);
      toast({
        title: "Comment deleted",
        description: "Your comment has been removed",
      });
      onCommentDeleted(comment.id);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to delete comment",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Process comment content to highlight @mentions
  const processContent = (content: string) => {
    const mentionRegex = /@([a-zA-Z0-9._-]+)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index));
      }
      
      // Add mention as a badge
      const username = match[1];
      const taggedUser = comment.taggedUsers.find(user => 
        user.displayName.toLowerCase() === username.toLowerCase()
      );
      
      if (taggedUser) {
        parts.push(
          <Badge 
            key={`mention-${match.index}`} 
            variant="secondary" 
            className="mx-1 text-primary bg-primary/10 hover:bg-primary/20"
          >
            <AtSign className="h-3 w-3 mr-1" />
            {username}
          </Badge>
        );
      } else {
        parts.push(`@${username}`);
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }
    
    return parts.length > 0 ? parts : [content];
  };

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex gap-3">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage src={comment.author.avatarUrl} alt={comment.author.displayName} />
            <AvatarFallback>
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{comment.author.displayName}</span>
                <span className="text-xs text-muted-foreground">{commentTime}</span>
              </div>
              
              {isOwnComment && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Comment</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this comment? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            
            <div className="text-sm leading-relaxed">
              {processContent(comment.content)}
            </div>
            
            {comment.taggedUsers.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {comment.taggedUsers.map((user) => (
                  <div key={user.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AtSign className="h-3 w-3" />
                    <span>{user.displayName}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}