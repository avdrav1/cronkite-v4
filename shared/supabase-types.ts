export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_usage: {
        Row: {
          clustering_count: number
          created_at: string
          id: string
          summary_count: number
          total_operations: number
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          clustering_count?: number
          created_at?: string
          id?: string
          summary_count?: number
          total_operations?: number
          updated_at?: string
          usage_date: string
          user_id: string
        }
        Update: {
          clustering_count?: number
          created_at?: string
          id?: string
          summary_count?: number
          total_operations?: number
          updated_at?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          ai_summary: string | null
          ai_summary_generated_at: string | null
          author: string | null
          cluster_id: string | null
          content: string | null
          created_at: string
          embedding: string | null
          excerpt: string | null
          feed_id: string
          fetched_at: string
          guid: string
          id: string
          image_url: string | null
          published_at: string | null
          title: string
          url: string
        }
        Insert: {
          ai_summary?: string | null
          ai_summary_generated_at?: string | null
          author?: string | null
          cluster_id?: string | null
          content?: string | null
          created_at?: string
          embedding?: string | null
          excerpt?: string | null
          feed_id: string
          fetched_at?: string
          guid: string
          id?: string
          image_url?: string | null
          published_at?: string | null
          title: string
          url: string
        }
        Update: {
          ai_summary?: string | null
          ai_summary_generated_at?: string | null
          author?: string | null
          cluster_id?: string | null
          content?: string | null
          created_at?: string
          embedding?: string | null
          excerpt?: string | null
          feed_id?: string
          fetched_at?: string
          guid?: string
          id?: string
          image_url?: string | null
          published_at?: string | null
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "feed_stats"
            referencedColumns: ["feed_id"]
          },
          {
            foreignKeyName: "articles_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "feeds"
            referencedColumns: ["id"]
          },
        ]
      }
      clusters: {
        Row: {
          article_count: number
          created_at: string
          expires_at: string | null
          id: string
          source_feeds: string[] | null
          summary: string | null
          timeframe_end: string | null
          timeframe_start: string | null
          title: string
          updated_at: string
        }
        Insert: {
          article_count?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          source_feeds?: string[] | null
          summary?: string | null
          timeframe_end?: string | null
          timeframe_start?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          article_count?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          source_feeds?: string[] | null
          summary?: string | null
          timeframe_end?: string | null
          timeframe_start?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      digest_history: {
        Row: {
          ai_summary: string | null
          article_count: number
          article_ids: string[]
          click_count: number
          clicked_at: string | null
          created_at: string
          delivery_method: string
          digest_type: string
          id: string
          opened_at: string | null
          sent_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_summary?: string | null
          article_count?: number
          article_ids?: string[]
          click_count?: number
          clicked_at?: string | null
          created_at?: string
          delivery_method?: string
          digest_type?: string
          id?: string
          opened_at?: string | null
          sent_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_summary?: string | null
          article_count?: number
          article_ids?: string[]
          click_count?: number
          clicked_at?: string | null
          created_at?: string
          delivery_method?: string
          digest_type?: string
          id?: string
          opened_at?: string | null
          sent_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "digest_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_sync_log: {
        Row: {
          articles_found: number | null
          articles_new: number | null
          articles_updated: number | null
          created_at: string
          error_message: string | null
          etag_received: string | null
          feed_id: string
          feed_size_bytes: number | null
          http_status_code: number | null
          id: string
          last_modified_received: string | null
          status: string
          sync_completed_at: string | null
          sync_duration_ms: number | null
          sync_started_at: string
        }
        Insert: {
          articles_found?: number | null
          articles_new?: number | null
          articles_updated?: number | null
          created_at?: string
          error_message?: string | null
          etag_received?: string | null
          feed_id: string
          feed_size_bytes?: number | null
          http_status_code?: number | null
          id?: string
          last_modified_received?: string | null
          status?: string
          sync_completed_at?: string | null
          sync_duration_ms?: number | null
          sync_started_at?: string
        }
        Update: {
          articles_found?: number | null
          articles_new?: number | null
          articles_updated?: number | null
          created_at?: string
          error_message?: string | null
          etag_received?: string | null
          feed_id?: string
          feed_size_bytes?: number | null
          http_status_code?: number | null
          id?: string
          last_modified_received?: string | null
          status?: string
          sync_completed_at?: string | null
          sync_duration_ms?: number | null
          sync_started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_sync_log_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "feed_stats"
            referencedColumns: ["feed_id"]
          },
          {
            foreignKeyName: "feed_sync_log_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "feeds"
            referencedColumns: ["id"]
          },
        ]
      }
      feeds: {
        Row: {
          article_count: number
          created_at: string
          custom_polling_interval: number | null
          description: string | null
          etag: string | null
          folder_id: string | null
          icon_color: string | null
          icon_url: string | null
          id: string
          last_fetched_at: string | null
          last_modified: string | null
          name: string
          priority: Database["public"]["Enums"]["feed_priority"]
          site_url: string | null
          status: Database["public"]["Enums"]["feed_status"]
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          article_count?: number
          created_at?: string
          custom_polling_interval?: number | null
          description?: string | null
          etag?: string | null
          folder_id?: string | null
          icon_color?: string | null
          icon_url?: string | null
          id?: string
          last_fetched_at?: string | null
          last_modified?: string | null
          name: string
          priority?: Database["public"]["Enums"]["feed_priority"]
          site_url?: string | null
          status?: Database["public"]["Enums"]["feed_status"]
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          article_count?: number
          created_at?: string
          custom_polling_interval?: number | null
          description?: string | null
          etag?: string | null
          folder_id?: string | null
          icon_color?: string | null
          icon_url?: string | null
          id?: string
          last_fetched_at?: string | null
          last_modified?: string | null
          name?: string
          priority?: Database["public"]["Enums"]["feed_priority"]
          site_url?: string | null
          status?: Database["public"]["Enums"]["feed_status"]
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feeds_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folder_unread_counts"
            referencedColumns: ["folder_id"]
          },
          {
            foreignKeyName: "feeds_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          email: string
          id: string
          onboarding_completed: boolean
          region_code: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          email: string
          id: string
          onboarding_completed?: boolean
          region_code?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          onboarding_completed?: boolean
          region_code?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      recommended_feeds: {
        Row: {
          article_frequency: string | null
          category: string
          country: string | null
          created_at: string
          description: string | null
          icon_url: string | null
          id: string
          is_featured: boolean
          language: string
          name: string
          popularity_score: number
          site_url: string | null
          tags: string[] | null
          updated_at: string
          url: string
        }
        Insert: {
          article_frequency?: string | null
          category: string
          country?: string | null
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          is_featured?: boolean
          language?: string
          name: string
          popularity_score?: number
          site_url?: string | null
          tags?: string[] | null
          updated_at?: string
          url: string
        }
        Update: {
          article_frequency?: string | null
          category?: string
          country?: string | null
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          is_featured?: boolean
          language?: string
          name?: string
          popularity_score?: number
          site_url?: string | null
          tags?: string[] | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      user_articles: {
        Row: {
          article_id: string
          clicked_at: string | null
          created_at: string
          id: string
          is_read: boolean
          is_starred: boolean
          read_at: string | null
          starred_at: string | null
          time_spent_seconds: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          article_id: string
          clicked_at?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          is_starred?: boolean
          read_at?: string | null
          starred_at?: string | null
          time_spent_seconds?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          article_id?: string
          clicked_at?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          is_starred?: boolean
          read_at?: string | null
          starred_at?: string | null
          time_spent_seconds?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_articles_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_articles_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles_with_embeddings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_articles_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles_with_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_articles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_interests: {
        Row: {
          category: string
          created_at: string
          id: string
          selected_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          selected_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          selected_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_interests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          accent_color: string
          adaptive_polling_enabled: boolean
          ai_clustering_enabled: boolean
          ai_daily_limit: string
          ai_summaries_enabled: boolean
          compact_view: boolean
          created_at: string
          default_polling_interval: string
          digest_enabled: boolean
          digest_frequency: string
          digest_max_articles: string
          digest_time: string
          digest_timezone: string
          id: string
          show_images: boolean
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accent_color?: string
          adaptive_polling_enabled?: boolean
          ai_clustering_enabled?: boolean
          ai_daily_limit?: string
          ai_summaries_enabled?: boolean
          compact_view?: boolean
          created_at?: string
          default_polling_interval?: string
          digest_enabled?: boolean
          digest_frequency?: string
          digest_max_articles?: string
          digest_time?: string
          digest_timezone?: string
          id?: string
          show_images?: boolean
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accent_color?: string
          adaptive_polling_enabled?: boolean
          ai_clustering_enabled?: boolean
          ai_daily_limit?: string
          ai_summaries_enabled?: boolean
          compact_view?: boolean
          created_at?: string
          default_polling_interval?: string
          digest_enabled?: boolean
          digest_frequency?: string
          digest_max_articles?: string
          digest_time?: string
          digest_timezone?: string
          id?: string
          show_images?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      articles_with_embeddings: {
        Row: {
          ai_summary: string | null
          ai_summary_generated_at: string | null
          author: string | null
          cluster_id: string | null
          content: string | null
          created_at: string | null
          excerpt: string | null
          feed_id: string | null
          feed_name: string | null
          fetched_at: string | null
          guid: string | null
          has_embedding: boolean | null
          id: string | null
          image_url: string | null
          published_at: string | null
          title: string | null
          url: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "feed_stats"
            referencedColumns: ["feed_id"]
          },
          {
            foreignKeyName: "articles_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "feeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      articles_with_feed: {
        Row: {
          ai_summary: string | null
          ai_summary_generated_at: string | null
          author: string | null
          cluster_id: string | null
          content: string | null
          created_at: string | null
          embedding: string | null
          excerpt: string | null
          feed_description: string | null
          feed_icon_color: string | null
          feed_icon_url: string | null
          feed_id: string | null
          feed_name: string | null
          feed_priority: Database["public"]["Enums"]["feed_priority"] | null
          feed_site_url: string | null
          feed_status: Database["public"]["Enums"]["feed_status"] | null
          feed_user_id: string | null
          fetched_at: string | null
          folder_icon: string | null
          folder_id: string | null
          folder_name: string | null
          folder_position: number | null
          guid: string | null
          id: string | null
          image_url: string | null
          published_at: string | null
          title: string | null
          url: string | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "feed_stats"
            referencedColumns: ["feed_id"]
          },
          {
            foreignKeyName: "articles_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "feeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeds_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folder_unread_counts"
            referencedColumns: ["folder_id"]
          },
          {
            foreignKeyName: "feeds_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeds_user_id_fkey"
            columns: ["feed_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_stats: {
        Row: {
          actual_article_count: number | null
          articles_last_24h: number | null
          articles_last_month: number | null
          articles_last_week: number | null
          feed_created_at: string | null
          feed_id: string | null
          feed_name: string | null
          feed_updated_at: string | null
          feed_url: string | null
          folder_id: string | null
          health_score: number | null
          last_error_message: string | null
          last_fetched_at: string | null
          last_successful_sync_at: string | null
          latest_article_fetched_at: string | null
          latest_article_published_at: string | null
          priority: Database["public"]["Enums"]["feed_priority"] | null
          starred_count: number | null
          status: Database["public"]["Enums"]["feed_status"] | null
          stored_article_count: number | null
          successful_syncs_last_week: number | null
          sync_attempts_last_week: number | null
          unread_count: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feeds_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folder_unread_counts"
            referencedColumns: ["folder_id"]
          },
          {
            foreignKeyName: "feeds_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      folder_unread_counts: {
        Row: {
          active_feeds: number | null
          created_at: string | null
          folder_icon: string | null
          folder_id: string | null
          folder_name: string | null
          latest_article_fetched_at: string | null
          latest_article_published_at: string | null
          position: number | null
          starred_articles: number | null
          total_articles: number | null
          total_feeds: number | null
          unread_articles: number | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "folders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      unfoldered_feed_stats: {
        Row: {
          active_feeds: number | null
          latest_article_fetched_at: string | null
          latest_article_published_at: string | null
          starred_articles: number | null
          total_articles: number | null
          total_feeds: number | null
          unread_articles: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feeds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_article_feed: {
        Row: {
          ai_summary: string | null
          ai_summary_generated_at: string | null
          article_created_at: string | null
          article_id: string | null
          author: string | null
          clicked_at: string | null
          cluster_article_count: number | null
          cluster_id: string | null
          cluster_summary: string | null
          cluster_title: string | null
          content: string | null
          excerpt: string | null
          feed_description: string | null
          feed_icon_color: string | null
          feed_icon_url: string | null
          feed_id: string | null
          feed_name: string | null
          feed_priority: Database["public"]["Enums"]["feed_priority"] | null
          feed_site_url: string | null
          feed_status: Database["public"]["Enums"]["feed_status"] | null
          fetched_at: string | null
          folder_icon: string | null
          folder_id: string | null
          folder_name: string | null
          folder_position: number | null
          guid: string | null
          image_url: string | null
          is_read: boolean | null
          is_starred: boolean | null
          published_at: string | null
          read_at: string | null
          starred_at: string | null
          time_spent_seconds: number | null
          title: string | null
          url: string | null
          user_article_created_at: string | null
          user_article_id: string | null
          user_article_updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "feed_stats"
            referencedColumns: ["feed_id"]
          },
          {
            foreignKeyName: "articles_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "feeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeds_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folder_unread_counts"
            referencedColumns: ["folder_id"]
          },
          {
            foreignKeyName: "feeds_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_articles_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_articles_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles_with_embeddings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_articles_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles_with_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_articles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_relevancy_score: {
        Args: { p_article_id: string; p_user_id?: string }
        Returns: number
      }
      cleanup_old_user_articles: {
        Args: { p_days_to_keep?: number; p_user_id: string }
        Returns: number
      }
      cluster_similar_articles: {
        Args: {
          max_articles_per_cluster?: number
          min_cluster_size?: number
          similarity_threshold?: number
          time_window_hours?: number
        }
        Returns: {
          avg_similarity: number
          cluster_articles: string[]
          representative_article_id: string
        }[]
      }
      complete_feed_sync_error: {
        Args: {
          p_error_message: string
          p_http_status_code?: number
          p_sync_log_id: string
        }
        Returns: undefined
      }
      complete_feed_sync_success: {
        Args: {
          p_articles_found?: number
          p_articles_new?: number
          p_articles_updated?: number
          p_etag_received?: string
          p_feed_size_bytes?: number
          p_http_status_code?: number
          p_last_modified_received?: string
          p_sync_log_id: string
        }
        Returns: undefined
      }
      cosine_similarity: {
        Args: { embedding1: string; embedding2: string }
        Returns: number
      }
      find_articles_similar_to: {
        Args: {
          max_results?: number
          similarity_threshold?: number
          source_article_id: string
          user_id_filter?: string
        }
        Returns: {
          article_id: string
          feed_name: string
          published_at: string
          similarity_score: number
          title: string
          url: string
        }[]
      }
      find_similar_articles: {
        Args: {
          max_results?: number
          query_embedding: string
          similarity_threshold?: number
          user_id_filter?: string
        }
        Returns: {
          article_id: string
          feed_name: string
          published_at: string
          similarity_score: number
          title: string
          url: string
        }[]
      }
      get_ai_usage_today: {
        Args: { p_user_id: string }
        Returns: {
          clustering_count: number
          summary_count: number
          total_operations: number
        }[]
      }
      get_article_recommendations: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          ai_summary: string
          article_id: string
          feed_name: string
          published_at: string
          relevancy_score: number
          title: string
        }[]
      }
      get_embedding_stats: {
        Args: never
        Returns: {
          articles_with_embeddings: number
          avg_embedding_age_hours: number
          embedding_coverage_percent: number
          total_articles: number
        }[]
      }
      get_feed_sync_stats: {
        Args: { p_feed_id: string }
        Returns: {
          avg_duration_ms: number
          failed_syncs: number
          last_successful_sync_at: string
          last_sync_at: string
          success_rate: number
          successful_syncs: number
          total_syncs: number
        }[]
      }
      get_recent_sync_logs: {
        Args: { p_feed_id: string; p_limit?: number }
        Returns: {
          articles_found: number
          articles_new: number
          articles_updated: number
          error_message: string
          http_status_code: number
          id: string
          status: string
          sync_completed_at: string
          sync_duration_ms: number
          sync_started_at: string
        }[]
      }
      get_user_reading_stats: {
        Args: { p_user_id: string }
        Returns: {
          active_feeds: number
          articles_read_this_month: number
          articles_read_this_week: number
          articles_read_today: number
          avg_reading_time_seconds: number
          read_articles: number
          reading_percentage: number
          starred_articles: number
          total_articles: number
          total_feeds: number
          unread_articles: number
        }[]
      }
      increment_ai_usage: {
        Args: {
          p_increment?: number
          p_operation_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      mark_all_read: {
        Args: { p_user_id: string }
        Returns: {
          articles_already_read: number
          articles_marked: number
        }[]
      }
      mark_feed_read: {
        Args: { p_feed_id: string; p_user_id: string }
        Returns: {
          articles_already_read: number
          articles_marked: number
        }[]
      }
      mark_folder_read: {
        Args: { p_folder_id: string; p_user_id: string }
        Returns: {
          articles_already_read: number
          articles_marked: number
        }[]
      }
      start_feed_sync: { Args: { p_feed_id: string }; Returns: string }
      update_digest_engagement: {
        Args: {
          p_action: string
          p_click_increment?: number
          p_digest_id: string
        }
        Returns: undefined
      }
      user_can_access_article: {
        Args: { article_id_to_check: string; user_id_to_check?: string }
        Returns: boolean
      }
      user_can_access_cluster: {
        Args: { cluster_id_to_check: string; user_id_to_check?: string }
        Returns: boolean
      }
      validate_email_format: {
        Args: { email_address: string }
        Returns: boolean
      }
      validate_timezone: { Args: { tz: string }; Returns: boolean }
      validate_url_format: { Args: { url_address: string }; Returns: boolean }
      verify_database_constraints: {
        Args: never
        Returns: {
          constraint_name: string
          constraint_type: string
          is_valid: boolean
          table_name: string
        }[]
      }
      verify_user_owns_resource: {
        Args: {
          resource_id: string
          resource_table: string
          user_id_to_check?: string
        }
        Returns: boolean
      }
    }
    Enums: {
      feed_priority: "high" | "medium" | "low"
      feed_status: "active" | "paused" | "error"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      feed_priority: ["high", "medium", "low"],
      feed_status: ["active", "paused", "error"],
    },
  },
} as const

