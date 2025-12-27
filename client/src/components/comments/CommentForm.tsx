import { useState, useRef, useCallback } from "react";
import { Send, AtSign, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { TagAutocomplete } from "./TagAutocomplete";

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

interface CommentFormProps {
  articleId: string;
  currentUserId: string;
  onCommentAdded: (comment: Comment) => void;
  onCancel?: () => void;
  placeholder?: string;
}

export function CommentForm({ 
  articleId, 
  currentUserId, 
  onCommentAdded, 
  onCancel,
  placeholder = "Share your thoughts with friends..."
}: CommentFormProps) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState("");
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const [currentMentionStart, setCurrentMentionStart] = useState(-1);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      toast({
        variant: "destructive",
        title: "Empty comment",
        description: "Please enter some content for your comment",
      });
      return;
    }

    if (trimmedContent.length > 2000) {
      toast({
        variant: "destructive",
        title: "Comment too long",
        description: "Comments cannot exceed 2000 characters",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiRequest('POST', `/api/articles/${articleId}/comments`, {
        content: trimmedContent
      });
      
      const data = await response.json();
      if (data.success) {
        onCommentAdded(data.comment);
        setContent("");
        setShowAutocomplete(false);
      } else {
        throw new Error(data.message || "Failed to add comment");
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to add comment",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);
    
    // Check for @mentions
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // Check if there's a space after @ (which would end the mention)
      if (!textAfterAt.includes(' ') && textAfterAt.length <= 50) {
        setAutocompleteQuery(textAfterAt);
        setCurrentMentionStart(lastAtIndex);
        setShowAutocomplete(true);
        
        // Calculate position for autocomplete dropdown
        if (textareaRef.current) {
          const textarea = textareaRef.current;
          const rect = textarea.getBoundingClientRect();
          const lineHeight = 20; // Approximate line height
          const lines = textBeforeCursor.split('\n').length;
          
          setAutocompletePosition({
            top: rect.top + (lines * lineHeight) + 25,
            left: rect.left + 10
          });
        }
      } else {
        setShowAutocomplete(false);
      }
    } else {
      setShowAutocomplete(false);
    }
  };

  const handleTagSelect = useCallback((username: string) => {
    if (currentMentionStart === -1) return;
    
    const beforeMention = content.slice(0, currentMentionStart);
    const afterCursor = content.slice(textareaRef.current?.selectionStart || content.length);
    const newContent = `${beforeMention}@${username} ${afterCursor}`;
    
    setContent(newContent);
    setShowAutocomplete(false);
    setCurrentMentionStart(-1);
    
    // Focus back to textarea
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPosition = beforeMention.length + username.length + 2;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
      }
    }, 0);
  }, [content, currentMentionStart]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit(e);
    }
    
    if (e.key === 'Escape' && showAutocomplete) {
      setShowAutocomplete(false);
    }
  };

  const handleCancel = () => {
    setContent("");
    setShowAutocomplete(false);
    onCancel?.();
  };

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={content}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="min-h-[80px] resize-none"
                disabled={isSubmitting}
              />
              
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <AtSign className="h-3 w-3" />
                  <span>Type @ to mention friends</span>
                </div>
                
                <div className="text-xs text-muted-foreground">
                  {content.length}/2000
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-2">
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              )}
              
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || !content.trim()}
                className="gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {isSubmitting ? "Posting..." : "Post Comment"}
              </Button>
            </div>
            
            <div className="text-xs text-muted-foreground">
              Press Ctrl+Enter to submit quickly
            </div>
          </form>
        </CardContent>
      </Card>
      
      {showAutocomplete && (
        <TagAutocomplete
          query={autocompleteQuery}
          currentUserId={currentUserId}
          position={autocompletePosition}
          onTagSelect={handleTagSelect}
          onClose={() => setShowAutocomplete(false)}
        />
      )}
    </>
  );
}