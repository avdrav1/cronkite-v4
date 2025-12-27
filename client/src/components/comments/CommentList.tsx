import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CommentCard } from "./CommentCard";
import { CommentForm } from "./CommentForm";

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

interface CommentsResponse {
  success: boolean;
  comments: Comment[];
  total: number;
  articleId: string;
}

interface CommentListProps {
  articleId: string;
  currentUserId: string;
  isOpen?: boolean;
}

export function CommentList({ articleId, currentUserId, isOpen = true }: CommentListProps) {
  const [showCommentForm, setShowCommentForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: commentsData,
    isLoading,
    error,
    refetch
  } = useQuery<CommentsResponse>({
    queryKey: ['/api/articles', articleId, 'comments'],
    enabled: isOpen && !!articleId,
    staleTime: 30000, // 30 seconds
  });

  const comments = commentsData?.comments || [];
  const commentCount = commentsData?.total || 0;

  const handleCommentAdded = (newComment: Comment) => {
    // Optimistically update the cache
    queryClient.setQueryData<CommentsResponse>(
      ['/api/articles', articleId, 'comments'],
      (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          comments: [newComment, ...oldData.comments],
          total: oldData.total + 1
        };
      }
    );
    
    setShowCommentForm(false);
    toast({
      title: "Comment added",
      description: "Your comment has been posted",
    });
  };

  const handleCommentDeleted = (commentId: string) => {
    // Optimistically update the cache
    queryClient.setQueryData<CommentsResponse>(
      ['/api/articles', articleId, 'comments'],
      (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          comments: oldData.comments.filter(comment => comment.id !== commentId),
          total: Math.max(0, oldData.total - 1)
        };
      }
    );
  };

  const handleRefresh = () => {
    refetch();
  };

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to load comments</span>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5" />
            Comments
            {commentCount > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({commentCount})
              </span>
            )}
          </CardTitle>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCommentForm(!showCommentForm)}
          >
            {showCommentForm ? "Cancel" : "Add Comment"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {showCommentForm && (
          <>
            <div className="px-6 pb-4">
              <CommentForm
                articleId={articleId}
                currentUserId={currentUserId}
                onCommentAdded={handleCommentAdded}
                onCancel={() => setShowCommentForm(false)}
              />
            </div>
            <Separator />
          </>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading comments...</span>
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <MessageCircle className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <p className="font-medium text-muted-foreground">No comments yet</p>
              <p className="text-sm text-muted-foreground/70">
                Be the first to share your thoughts with friends
              </p>
            </div>
            {!showCommentForm && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCommentForm(true)}
              >
                Add Comment
              </Button>
            )}
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <div className="space-y-3 p-6">
              {comments.map((comment) => (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  currentUserId={currentUserId}
                  onCommentDeleted={handleCommentDeleted}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}