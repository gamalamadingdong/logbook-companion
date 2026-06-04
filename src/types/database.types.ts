export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_feed: {
        Row: {
          activity_type: string
          created_at: string | null
          description: string | null
          id: string
          is_public: boolean | null
          metadata: Json | null
          team_id: string | null
          title: string
          user_id: string
          workout_log_id: string | null
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          metadata?: Json | null
          team_id?: string | null
          title: string
          user_id: string
          workout_log_id?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          metadata?: Json | null
          team_id?: string | null
          title?: string
          user_id?: string
          workout_log_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_feed_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "activity_feed_workout_log_id_fkey"
            columns: ["workout_log_id"]
            isOneToOne: false
            referencedRelation: "workout_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          message_count: number
          messages: Json
          metadata: Json | null
          phase: string
          team_id: string | null
          thread_id: string
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          message_count?: number
          messages?: Json
          metadata?: Json | null
          phase?: string
          team_id?: string | null
          thread_id: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          message_count?: number
          messages?: Json
          metadata?: Json | null
          phase?: string
          team_id?: string | null
          thread_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_help_feedback: {
        Row: {
          conversation_id: string
          created_at: string
          feedback_text: string | null
          id: string
          message_id: string
          rating: number | null
          user_id: string
          was_helpful: boolean | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          feedback_text?: string | null
          id?: string
          message_id: string
          rating?: number | null
          user_id: string
          was_helpful?: boolean | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          feedback_text?: string | null
          id?: string
          message_id?: string
          rating?: number | null
          user_id?: string
          was_helpful?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_help_feedback_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_help_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "ai_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          cost_usd: number | null
          created_at: string
          id: string
          message_id: string | null
          metadata: Json | null
          role: string
          tokens_used: number | null
        }
        Insert: {
          content: string
          conversation_id: string
          cost_usd?: number | null
          created_at?: string
          id?: string
          message_id?: string | null
          metadata?: Json | null
          role: string
          tokens_used?: number | null
        }
        Update: {
          content?: string
          conversation_id?: string
          cost_usd?: number | null
          created_at?: string
          id?: string
          message_id?: string | null
          metadata?: Json | null
          role?: string
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_recommendation_outcomes: {
        Row: {
          adherence_next_week: number | null
          athlete_feedback: string | null
          created_at: string | null
          id: string
          outcome_quality: string | null
          performance_change: number | null
          rating_next_week: number | null
          recommendation_id: string
        }
        Insert: {
          adherence_next_week?: number | null
          athlete_feedback?: string | null
          created_at?: string | null
          id?: string
          outcome_quality?: string | null
          performance_change?: number | null
          rating_next_week?: number | null
          recommendation_id: string
        }
        Update: {
          adherence_next_week?: number | null
          athlete_feedback?: string | null
          created_at?: string | null
          id?: string
          outcome_quality?: string | null
          performance_change?: number | null
          rating_next_week?: number | null
          recommendation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_recommendation_outcomes_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "ai_recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_recommendations: {
        Row: {
          accepted_at: string | null
          athlete_message: string | null
          context: Json | null
          created_at: string | null
          id: string
          rationale: string | null
          recommendation: Json
          recommendation_type: string
          updated_at: string | null
          user_id: string
          was_accepted: boolean | null
        }
        Insert: {
          accepted_at?: string | null
          athlete_message?: string | null
          context?: Json | null
          created_at?: string | null
          id?: string
          rationale?: string | null
          recommendation: Json
          recommendation_type: string
          updated_at?: string | null
          user_id: string
          was_accepted?: boolean | null
        }
        Update: {
          accepted_at?: string | null
          athlete_message?: string | null
          context?: Json | null
          created_at?: string | null
          id?: string
          rationale?: string | null
          recommendation?: Json
          recommendation_type?: string
          updated_at?: string | null
          user_id?: string
          was_accepted?: boolean | null
        }
        Relationships: []
      }
      ai_safety_rules: {
        Row: {
          description: string | null
          enabled: boolean | null
          id: string
          rule_name: string
          rule_type: string
          rule_value: Json
          updated_at: string | null
        }
        Insert: {
          description?: string | null
          enabled?: boolean | null
          id?: string
          rule_name: string
          rule_type: string
          rule_value: Json
          updated_at?: string | null
        }
        Update: {
          description?: string | null
          enabled?: boolean | null
          id?: string
          rule_name?: string
          rule_type?: string
          rule_value?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          completion_tokens: number
          created_at: string | null
          endpoint: string
          estimated_cost: number
          feature: string | null
          id: string
          model: string
          prompt_tokens: number
          timestamp: string
          total_tokens: number
          user_id: string | null
        }
        Insert: {
          completion_tokens: number
          created_at?: string | null
          endpoint: string
          estimated_cost: number
          feature?: string | null
          id?: string
          model: string
          prompt_tokens: number
          timestamp?: string
          total_tokens: number
          user_id?: string | null
        }
        Update: {
          completion_tokens?: number
          created_at?: string | null
          endpoint?: string
          estimated_cost?: number
          feature?: string | null
          id?: string
          model?: string
          prompt_tokens?: number
          timestamp?: string
          total_tokens?: number
          user_id?: string | null
        }
        Relationships: []
      }
      app_notifications: {
        Row: {
          body: string
          created_at: string
          href: string | null
          id: string
          metadata: Json
          read: boolean
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          href?: string | null
          id?: string
          metadata?: Json
          read?: boolean
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          href?: string | null
          id?: string
          metadata?: Json
          read?: boolean
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      assignment_result_shares: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          group_assignment_id: string
          id: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          group_assignment_id: string
          id?: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          group_assignment_id?: string
          id?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_result_shares_group_assignment_id_fkey"
            columns: ["group_assignment_id"]
            isOneToOne: false
            referencedRelation: "group_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      athletes: {
        Row: {
          coach_notes: string | null
          coach_notes_visible_to_athlete: boolean
          created_at: string
          created_by: string
          date_of_birth: string | null
          email: string | null
          experience_level: string | null
          first_name: string
          grade: string | null
          height_cm: number | null
          id: string
          last_name: string
          notes: string | null
          side: string | null
          updated_at: string
          user_id: string | null
          weight_kg: number | null
        }
        Insert: {
          coach_notes?: string | null
          coach_notes_visible_to_athlete?: boolean
          created_at?: string
          created_by: string
          date_of_birth?: string | null
          email?: string | null
          experience_level?: string | null
          first_name: string
          grade?: string | null
          height_cm?: number | null
          id?: string
          last_name: string
          notes?: string | null
          side?: string | null
          updated_at?: string
          user_id?: string | null
          weight_kg?: number | null
        }
        Update: {
          coach_notes?: string | null
          coach_notes_visible_to_athlete?: boolean
          created_at?: string
          created_by?: string
          date_of_birth?: string | null
          email?: string | null
          experience_level?: string | null
          first_name?: string
          grade?: string | null
          height_cm?: number | null
          id?: string
          last_name?: string
          notes?: string | null
          side?: string | null
          updated_at?: string
          user_id?: string | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      coaching_access_requests: {
        Row: {
          created_at: string
          display_name: string
          id: string
          message: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      coaching_athlete_coach_notes: {
        Row: {
          athlete_id: string
          coach_user_id: string
          created_at: string
          id: string
          note: string
          team_id: string
          updated_at: string
          visible_to_athlete: boolean
        }
        Insert: {
          athlete_id: string
          coach_user_id: string
          created_at?: string
          id?: string
          note: string
          team_id: string
          updated_at?: string
          visible_to_athlete?: boolean
        }
        Update: {
          athlete_id?: string
          coach_user_id?: string
          created_at?: string
          id?: string
          note?: string
          team_id?: string
          updated_at?: string
          visible_to_athlete?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "coaching_athlete_coach_notes_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_athlete_coach_notes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_athlete_notes: {
        Row: {
          athlete_id: string
          coach_user_id: string
          created_at: string
          id: string
          note: string
          session_id: string
          team_id: string | null
        }
        Insert: {
          athlete_id: string
          coach_user_id: string
          created_at?: string
          id?: string
          note: string
          session_id: string
          team_id?: string | null
        }
        Update: {
          athlete_id?: string
          coach_user_id?: string
          created_at?: string
          id?: string
          note?: string
          session_id?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coaching_athlete_notes_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_athlete_notes_coach_user_id_fkey"
            columns: ["coach_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coaching_athlete_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "coaching_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_athlete_notes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_athletes: {
        Row: {
          coach_user_id: string
          created_at: string
          experience_level: string | null
          grade: string | null
          id: string
          name: string
          notes: string | null
          side: string | null
          updated_at: string
        }
        Insert: {
          coach_user_id: string
          created_at?: string
          experience_level?: string | null
          grade?: string | null
          id?: string
          name: string
          notes?: string | null
          side?: string | null
          updated_at?: string
        }
        Update: {
          coach_user_id?: string
          created_at?: string
          experience_level?: string | null
          grade?: string | null
          id?: string
          name?: string
          notes?: string | null
          side?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_athletes_coach_user_id_fkey"
            columns: ["coach_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      coaching_boating_race_results: {
        Row: {
          boating_id: string
          coach_user_id: string
          created_at: string
          distance_meters: number
          event_name: string
          id: string
          lineup_positions: Json
          lineup_signature: string
          notes: string | null
          race_date: string
          schedule_event_id: string | null
          team_id: string
          time_seconds: number
          updated_at: string
        }
        Insert: {
          boating_id: string
          coach_user_id: string
          created_at?: string
          distance_meters: number
          event_name: string
          id?: string
          lineup_positions?: Json
          lineup_signature: string
          notes?: string | null
          race_date: string
          schedule_event_id?: string | null
          team_id: string
          time_seconds: number
          updated_at?: string
        }
        Update: {
          boating_id?: string
          coach_user_id?: string
          created_at?: string
          distance_meters?: number
          event_name?: string
          id?: string
          lineup_positions?: Json
          lineup_signature?: string
          notes?: string | null
          race_date?: string
          schedule_event_id?: string | null
          team_id?: string
          time_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_boating_race_results_boating_id_fkey"
            columns: ["boating_id"]
            isOneToOne: false
            referencedRelation: "coaching_boatings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_boating_race_results_schedule_event_id_fkey"
            columns: ["schedule_event_id"]
            isOneToOne: false
            referencedRelation: "coaching_schedule_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_boating_race_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_boatings: {
        Row: {
          boat_id: string | null
          boat_name: string
          boat_type: string
          coach_user_id: string
          created_at: string
          date: string
          id: string
          is_active: boolean | null
          notes: string | null
          positions: Json
          session_id: string | null
          sort_order: number | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          boat_id?: string | null
          boat_name: string
          boat_type: string
          coach_user_id: string
          created_at?: string
          date: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          positions?: Json
          session_id?: string | null
          sort_order?: number | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          boat_id?: string | null
          boat_name?: string
          boat_type?: string
          coach_user_id?: string
          created_at?: string
          date?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          positions?: Json
          session_id?: string | null
          sort_order?: number | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_boatings_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "coaching_boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_boatings_coach_user_id_fkey"
            columns: ["coach_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coaching_boatings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "coaching_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_boatings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_boats: {
        Row: {
          boat_name: string
          boat_type: string
          coach_user_id: string
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          sort_order: number
          team_id: string
          updated_at: string
        }
        Insert: {
          boat_name: string
          boat_type: string
          coach_user_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          sort_order?: number
          team_id: string
          updated_at?: string
        }
        Update: {
          boat_name?: string
          boat_type?: string
          coach_user_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          sort_order?: number
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_boats_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_erg_scores: {
        Row: {
          athlete_id: string
          coach_user_id: string
          created_at: string
          date: string
          distance: number
          heart_rate: number | null
          id: string
          notes: string | null
          split_500m: number | null
          stroke_rate: number | null
          team_id: string | null
          time_seconds: number
          watts: number | null
        }
        Insert: {
          athlete_id: string
          coach_user_id: string
          created_at?: string
          date: string
          distance: number
          heart_rate?: number | null
          id?: string
          notes?: string | null
          split_500m?: number | null
          stroke_rate?: number | null
          team_id?: string | null
          time_seconds: number
          watts?: number | null
        }
        Update: {
          athlete_id?: string
          coach_user_id?: string
          created_at?: string
          date?: string
          distance?: number
          heart_rate?: number | null
          id?: string
          notes?: string | null
          split_500m?: number | null
          stroke_rate?: number | null
          team_id?: string | null
          time_seconds?: number
          watts?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coaching_erg_scores_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_erg_scores_coach_user_id_fkey"
            columns: ["coach_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coaching_erg_scores_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_schedule_events: {
        Row: {
          coach_user_id: string
          created_at: string
          date: string
          end_date: string | null
          event_type: string
          id: string
          location: string | null
          notes: string | null
          org_id: string
          team_ids: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          coach_user_id: string
          created_at?: string
          date: string
          end_date?: string | null
          event_type: string
          id?: string
          location?: string | null
          notes?: string | null
          org_id: string
          team_ids?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          coach_user_id?: string
          created_at?: string
          date?: string
          end_date?: string | null
          event_type?: string
          id?: string
          location?: string | null
          notes?: string | null
          org_id?: string
          team_ids?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_schedule_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_session_crew_positions: {
        Row: {
          athlete_id: string | null
          athlete_name: string
          coach_user_id: string
          created_at: string
          id: string
          seat: number
          session_crew_id: string
          team_id: string
        }
        Insert: {
          athlete_id?: string | null
          athlete_name: string
          coach_user_id: string
          created_at?: string
          id?: string
          seat: number
          session_crew_id: string
          team_id: string
        }
        Update: {
          athlete_id?: string | null
          athlete_name?: string
          coach_user_id?: string
          created_at?: string
          id?: string
          seat?: number
          session_crew_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_session_crew_positions_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_session_crew_positions_session_crew_id_fkey"
            columns: ["session_crew_id"]
            isOneToOne: false
            referencedRelation: "coaching_session_crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_session_crew_positions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_session_crews: {
        Row: {
          boat_id: string | null
          boat_name: string
          boat_type: string
          coach_user_id: string
          created_at: string
          id: string
          notes: string | null
          session_id: string
          sort_order: number
          source_boating_id: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          boat_id?: string | null
          boat_name: string
          boat_type: string
          coach_user_id: string
          created_at?: string
          id?: string
          notes?: string | null
          session_id: string
          sort_order?: number
          source_boating_id?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          boat_id?: string | null
          boat_name?: string
          boat_type?: string
          coach_user_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          session_id?: string
          sort_order?: number
          source_boating_id?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_session_crews_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "coaching_boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_session_crews_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "coaching_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_session_crews_source_boating_id_fkey"
            columns: ["source_boating_id"]
            isOneToOne: false
            referencedRelation: "coaching_boatings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_session_crews_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_sessions: {
        Row: {
          coach_user_id: string
          created_at: string
          date: string
          focus: string | null
          general_notes: string | null
          group_assignment_id: string | null
          id: string
          team_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          coach_user_id: string
          created_at?: string
          date: string
          focus?: string | null
          general_notes?: string | null
          group_assignment_id?: string | null
          id?: string
          team_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          coach_user_id?: string
          created_at?: string
          date?: string
          focus?: string | null
          general_notes?: string | null
          group_assignment_id?: string | null
          id?: string
          team_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_sessions_coach_user_id_fkey"
            columns: ["coach_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coaching_sessions_group_assignment_id_fkey"
            columns: ["group_assignment_id"]
            isOneToOne: false
            referencedRelation: "group_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_weekly_plans: {
        Row: {
          coaching_points: string[] | null
          created_at: string | null
          created_by: string
          drill_examples: string[] | null
          goals: string[] | null
          id: string
          notes: string | null
          piece_examples: string[] | null
          reflection: string | null
          team_id: string
          theme: string | null
          updated_at: string | null
          week_start: string
        }
        Insert: {
          coaching_points?: string[] | null
          created_at?: string | null
          created_by: string
          drill_examples?: string[] | null
          goals?: string[] | null
          id?: string
          notes?: string | null
          piece_examples?: string[] | null
          reflection?: string | null
          team_id: string
          theme?: string | null
          updated_at?: string | null
          week_start: string
        }
        Update: {
          coaching_points?: string[] | null
          created_at?: string | null
          created_by?: string
          drill_examples?: string[] | null
          goals?: string[] | null
          id?: string
          notes?: string | null
          piece_examples?: string[] | null
          reflection?: string | null
          team_id?: string
          theme?: string | null
          updated_at?: string | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_weekly_plans_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      community_items: {
        Row: {
          created_at: string
          details: string
          github_issue_url: string | null
          id: string
          item_type: string
          moderated_at: string | null
          moderated_by: string | null
          moderation_note: string | null
          product_area: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details: string
          github_issue_url?: string | null
          id?: string
          item_type: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          product_area?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: string
          github_issue_url?: string | null
          id?: string
          item_type?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          product_area?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      community_votes: {
        Row: {
          community_item_id: string
          created_at: string
          id: string
          user_id: string
          vote: number
        }
        Insert: {
          community_item_id: string
          created_at?: string
          id?: string
          user_id: string
          vote?: number
        }
        Update: {
          community_item_id?: string
          created_at?: string
          id?: string
          user_id?: string
          vote?: number
        }
        Relationships: [
          {
            foreignKeyName: "community_votes_community_item_id_fkey"
            columns: ["community_item_id"]
            isOneToOne: false
            referencedRelation: "community_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_review_queue: {
        Row: {
          accuracy_rating: number | null
          assigned_at: string | null
          assigned_to_coach_id: string | null
          changes_requested: string[] | null
          coach_notes: string | null
          content_data: Json
          content_id: string
          content_type: string
          created_at: string | null
          generated_at: string | null
          generated_by_agent: string
          generation_request: Json
          id: string
          priority: string | null
          published_at: string | null
          quality_rating: number | null
          rejection_reason: string | null
          requested_by_role: string | null
          requested_by_user_id: string | null
          review_duration_minutes: number | null
          reviewed_at: string | null
          reviewed_by_coach_id: string | null
          revision_count: number | null
          safety_rating: number | null
          status: string | null
          updated_at: string | null
          validated: boolean | null
        }
        Insert: {
          accuracy_rating?: number | null
          assigned_at?: string | null
          assigned_to_coach_id?: string | null
          changes_requested?: string[] | null
          coach_notes?: string | null
          content_data: Json
          content_id: string
          content_type: string
          created_at?: string | null
          generated_at?: string | null
          generated_by_agent: string
          generation_request: Json
          id?: string
          priority?: string | null
          published_at?: string | null
          quality_rating?: number | null
          rejection_reason?: string | null
          requested_by_role?: string | null
          requested_by_user_id?: string | null
          review_duration_minutes?: number | null
          reviewed_at?: string | null
          reviewed_by_coach_id?: string | null
          revision_count?: number | null
          safety_rating?: number | null
          status?: string | null
          updated_at?: string | null
          validated?: boolean | null
        }
        Update: {
          accuracy_rating?: number | null
          assigned_at?: string | null
          assigned_to_coach_id?: string | null
          changes_requested?: string[] | null
          coach_notes?: string | null
          content_data?: Json
          content_id?: string
          content_type?: string
          created_at?: string | null
          generated_at?: string | null
          generated_by_agent?: string
          generation_request?: Json
          id?: string
          priority?: string | null
          published_at?: string | null
          quality_rating?: number | null
          rejection_reason?: string | null
          requested_by_role?: string | null
          requested_by_user_id?: string | null
          review_duration_minutes?: number | null
          reviewed_at?: string | null
          reviewed_by_coach_id?: string | null
          revision_count?: number | null
          safety_rating?: number | null
          status?: string | null
          updated_at?: string | null
          validated?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "content_review_queue_assigned_to_coach_id_fkey"
            columns: ["assigned_to_coach_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "content_review_queue_requested_by_user_id_fkey"
            columns: ["requested_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "content_review_queue_reviewed_by_coach_id_fkey"
            columns: ["reviewed_by_coach_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      daily_workout_assignments: {
        Row: {
          actual_workout: Json | null
          athlete_id: string | null
          completed: boolean | null
          completed_at: string | null
          completed_log_id: string | null
          created_at: string
          day_of_week: number | null
          group_assignment_id: string | null
          id: string
          is_test: boolean
          original_template_id: string | null
          phase_name: string | null
          plan_id: string | null
          result_distance_meters: number | null
          result_intervals: Json | null
          result_split_seconds: number | null
          result_stroke_rate: number | null
          result_time_seconds: number | null
          result_weight_kg: number | null
          scheduled_workout: Json | null
          substituted_template_id: string | null
          substitution_reason: string | null
          team_id: string | null
          titan_index: number | null
          updated_at: string
          user_id: string | null
          was_substituted: boolean | null
          week_number: number | null
          workout_date: string
        }
        Insert: {
          actual_workout?: Json | null
          athlete_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          completed_log_id?: string | null
          created_at?: string
          day_of_week?: number | null
          group_assignment_id?: string | null
          id?: string
          is_test?: boolean
          original_template_id?: string | null
          phase_name?: string | null
          plan_id?: string | null
          result_distance_meters?: number | null
          result_intervals?: Json | null
          result_split_seconds?: number | null
          result_stroke_rate?: number | null
          result_time_seconds?: number | null
          result_weight_kg?: number | null
          scheduled_workout?: Json | null
          substituted_template_id?: string | null
          substitution_reason?: string | null
          team_id?: string | null
          titan_index?: number | null
          updated_at?: string
          user_id?: string | null
          was_substituted?: boolean | null
          week_number?: number | null
          workout_date: string
        }
        Update: {
          actual_workout?: Json | null
          athlete_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          completed_log_id?: string | null
          created_at?: string
          day_of_week?: number | null
          group_assignment_id?: string | null
          id?: string
          is_test?: boolean
          original_template_id?: string | null
          phase_name?: string | null
          plan_id?: string | null
          result_distance_meters?: number | null
          result_intervals?: Json | null
          result_split_seconds?: number | null
          result_stroke_rate?: number | null
          result_time_seconds?: number | null
          result_weight_kg?: number | null
          scheduled_workout?: Json | null
          substituted_template_id?: string | null
          substitution_reason?: string | null
          team_id?: string | null
          titan_index?: number | null
          updated_at?: string
          user_id?: string | null
          was_substituted?: boolean | null
          week_number?: number | null
          workout_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_workout_assignments_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_workout_assignments_completed_log_id_fkey"
            columns: ["completed_log_id"]
            isOneToOne: false
            referencedRelation: "workout_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_workout_assignments_group_assignment_id_fkey"
            columns: ["group_assignment_id"]
            isOneToOne: false
            referencedRelation: "group_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_workout_assignments_original_template_id_fkey"
            columns: ["original_template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_workout_assignments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_workout_assignments_substituted_template_id_fkey"
            columns: ["substituted_template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_workout_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      drill_ratings: {
        Row: {
          clarity_rating: number | null
          completion_count: number | null
          created_at: string | null
          difficulty_rating: number | null
          drill_id: string
          effectiveness_rating: number | null
          id: string
          overall_rating: number
          review_text: string | null
          technique_improvement_noticed: boolean | null
          updated_at: string | null
          user_experience_level: string | null
          user_id: string
          would_recommend: boolean | null
        }
        Insert: {
          clarity_rating?: number | null
          completion_count?: number | null
          created_at?: string | null
          difficulty_rating?: number | null
          drill_id: string
          effectiveness_rating?: number | null
          id?: string
          overall_rating: number
          review_text?: string | null
          technique_improvement_noticed?: boolean | null
          updated_at?: string | null
          user_experience_level?: string | null
          user_id: string
          would_recommend?: boolean | null
        }
        Update: {
          clarity_rating?: number | null
          completion_count?: number | null
          created_at?: string | null
          difficulty_rating?: number | null
          drill_id?: string
          effectiveness_rating?: number | null
          id?: string
          overall_rating?: number
          review_text?: string | null
          technique_improvement_noticed?: boolean | null
          updated_at?: string | null
          user_experience_level?: string | null
          user_id?: string
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "drill_ratings_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "drills"
            referencedColumns: ["id"]
          },
        ]
      }
      drills: {
        Row: {
          benefits: string | null
          category: string
          coaching_points: string[] | null
          common_errors: string[] | null
          created_at: string | null
          created_by: string
          description: string | null
          difficulty_level: string | null
          duration: number | null
          equipment: string[] | null
          exported_at: string | null
          id: string
          media_urls: Json | null
          name: string
          on_water: boolean | null
          physiological_purpose: string | null
          procedure: string | null
          progression_path: string[] | null
          related_drills: string[] | null
          setup_time: number | null
          source: string | null
          tags: string[] | null
          technical_focus_points: string[] | null
          updated_at: string | null
          validated: boolean | null
          variations: Json | null
        }
        Insert: {
          benefits?: string | null
          category: string
          coaching_points?: string[] | null
          common_errors?: string[] | null
          created_at?: string | null
          created_by: string
          description?: string | null
          difficulty_level?: string | null
          duration?: number | null
          equipment?: string[] | null
          exported_at?: string | null
          id?: string
          media_urls?: Json | null
          name: string
          on_water?: boolean | null
          physiological_purpose?: string | null
          procedure?: string | null
          progression_path?: string[] | null
          related_drills?: string[] | null
          setup_time?: number | null
          source?: string | null
          tags?: string[] | null
          technical_focus_points?: string[] | null
          updated_at?: string | null
          validated?: boolean | null
          variations?: Json | null
        }
        Update: {
          benefits?: string | null
          category?: string
          coaching_points?: string[] | null
          common_errors?: string[] | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          difficulty_level?: string | null
          duration?: number | null
          equipment?: string[] | null
          exported_at?: string | null
          id?: string
          media_urls?: Json | null
          name?: string
          on_water?: boolean | null
          physiological_purpose?: string | null
          procedure?: string | null
          progression_path?: string[] | null
          related_drills?: string[] | null
          setup_time?: number | null
          source?: string | null
          tags?: string[] | null
          technical_focus_points?: string[] | null
          updated_at?: string | null
          validated?: boolean | null
          variations?: Json | null
        }
        Relationships: []
      }
      erg_session_participants: {
        Row: {
          created_at: string | null
          data: Json | null
          device_id: string | null
          display_name: string
          group_name: string | null
          id: string
          last_heartbeat: string | null
          session_id: string
          status: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          device_id?: string | null
          display_name: string
          group_name?: string | null
          id?: string
          last_heartbeat?: string | null
          session_id: string
          status: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          device_id?: string | null
          display_name?: string
          group_name?: string | null
          id?: string
          last_heartbeat?: string | null
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "erg_session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "erg_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      erg_sessions: {
        Row: {
          active_workout: Json | null
          created_at: string | null
          created_by: string | null
          ended_at: string | null
          id: string
          join_code: string
          race_state: number | null
          status: string
        }
        Insert: {
          active_workout?: Json | null
          created_at?: string | null
          created_by?: string | null
          ended_at?: string | null
          id?: string
          join_code: string
          race_state?: number | null
          status: string
        }
        Update: {
          active_workout?: Json | null
          created_at?: string | null
          created_by?: string | null
          ended_at?: string | null
          id?: string
          join_code?: string
          race_state?: number | null
          status?: string
        }
        Relationships: []
      }
      exercises: {
        Row: {
          category: string
          coaching_cues: string[] | null
          common_errors: string[] | null
          created_at: string | null
          created_by: string | null
          demonstration_video_url: string | null
          description: string | null
          difficulty_level: string
          duration_seconds: number | null
          equipment: string[] | null
          id: string
          image_url: string | null
          instructions: string | null
          name: string
          post_rowing: boolean | null
          pre_rowing: boolean | null
          rowing_specific: boolean | null
          tags: string[] | null
          target_areas: string[] | null
          updated_at: string | null
          validated: boolean | null
        }
        Insert: {
          category: string
          coaching_cues?: string[] | null
          common_errors?: string[] | null
          created_at?: string | null
          created_by?: string | null
          demonstration_video_url?: string | null
          description?: string | null
          difficulty_level?: string
          duration_seconds?: number | null
          equipment?: string[] | null
          id?: string
          image_url?: string | null
          instructions?: string | null
          name: string
          post_rowing?: boolean | null
          pre_rowing?: boolean | null
          rowing_specific?: boolean | null
          tags?: string[] | null
          target_areas?: string[] | null
          updated_at?: string | null
          validated?: boolean | null
        }
        Update: {
          category?: string
          coaching_cues?: string[] | null
          common_errors?: string[] | null
          created_at?: string | null
          created_by?: string | null
          demonstration_video_url?: string | null
          description?: string | null
          difficulty_level?: string
          duration_seconds?: number | null
          equipment?: string[] | null
          id?: string
          image_url?: string | null
          instructions?: string | null
          name?: string
          post_rowing?: boolean | null
          pre_rowing?: boolean | null
          rowing_specific?: boolean | null
          tags?: string[] | null
          target_areas?: string[] | null
          updated_at?: string | null
          validated?: boolean | null
        }
        Relationships: []
      }
      fitness_sessions: {
        Row: {
          body_readiness: number | null
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          duration_minutes: number | null
          energy_level_after: number | null
          energy_level_before: number | null
          id: string
          notes: string | null
          post_rowing_session: boolean | null
          pre_rowing_session: boolean | null
          related_rowing_session_id: string | null
          session_name: string | null
          session_type: string
          started_at: string
          template_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          body_readiness?: number | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          energy_level_after?: number | null
          energy_level_before?: number | null
          id?: string
          notes?: string | null
          post_rowing_session?: boolean | null
          pre_rowing_session?: boolean | null
          related_rowing_session_id?: string | null
          session_name?: string | null
          session_type: string
          started_at: string
          template_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          body_readiness?: number | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          energy_level_after?: number | null
          energy_level_before?: number | null
          id?: string
          notes?: string | null
          post_rowing_session?: boolean | null
          pre_rowing_session?: boolean | null
          related_rowing_session_id?: string | null
          session_name?: string | null
          session_type?: string
          started_at?: string
          template_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fitness_sessions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "fitness_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fitness_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      fitness_template_exercises: {
        Row: {
          coaching_emphasis: string | null
          created_at: string | null
          duration_seconds: number | null
          each_side: boolean | null
          exercise_id: string
          id: string
          notes: string | null
          order_in_template: number
          repetitions: number | null
          rest_after_seconds: number | null
          template_id: string
          updated_at: string | null
        }
        Insert: {
          coaching_emphasis?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          each_side?: boolean | null
          exercise_id: string
          id?: string
          notes?: string | null
          order_in_template: number
          repetitions?: number | null
          rest_after_seconds?: number | null
          template_id: string
          updated_at?: string | null
        }
        Update: {
          coaching_emphasis?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          each_side?: boolean | null
          exercise_id?: string
          id?: string
          notes?: string | null
          order_in_template?: number
          repetitions?: number | null
          rest_after_seconds?: number | null
          template_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fitness_template_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fitness_template_exercises_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "fitness_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      fitness_templates: {
        Row: {
          benefits: string[] | null
          created_at: string | null
          created_by: string | null
          description: string | null
          difficulty_level: string
          equipment_optional: string[] | null
          equipment_required: string[] | null
          estimated_duration_minutes: number
          home_friendly: boolean | null
          id: string
          max_duration_minutes: number | null
          min_duration_minutes: number | null
          name: string
          objective: string | null
          post_rowing: boolean | null
          pre_rowing: boolean | null
          rowing_rest_day: boolean | null
          source: string | null
          tags: string[] | null
          template_type: string
          updated_at: string | null
          user_rating: number | null
          validated: boolean | null
          when_to_use: string | null
          workout_intensity: string | null
        }
        Insert: {
          benefits?: string[] | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty_level?: string
          equipment_optional?: string[] | null
          equipment_required?: string[] | null
          estimated_duration_minutes: number
          home_friendly?: boolean | null
          id?: string
          max_duration_minutes?: number | null
          min_duration_minutes?: number | null
          name: string
          objective?: string | null
          post_rowing?: boolean | null
          pre_rowing?: boolean | null
          rowing_rest_day?: boolean | null
          source?: string | null
          tags?: string[] | null
          template_type: string
          updated_at?: string | null
          user_rating?: number | null
          validated?: boolean | null
          when_to_use?: string | null
          workout_intensity?: string | null
        }
        Update: {
          benefits?: string[] | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty_level?: string
          equipment_optional?: string[] | null
          equipment_required?: string[] | null
          estimated_duration_minutes?: number
          home_friendly?: boolean | null
          id?: string
          max_duration_minutes?: number | null
          min_duration_minutes?: number | null
          name?: string
          objective?: string | null
          post_rowing?: boolean | null
          pre_rowing?: boolean | null
          rowing_rest_day?: boolean | null
          source?: string | null
          tags?: string[] | null
          template_type?: string
          updated_at?: string | null
          user_rating?: number | null
          validated?: boolean | null
          when_to_use?: string | null
          workout_intensity?: string | null
        }
        Relationships: []
      }
      generated_workout_candidates: {
        Row: {
          average_rating: number | null
          coaching_notes: string | null
          completion_rate: number | null
          created_at: string | null
          duration_minutes: number | null
          generated_by_user_id: string | null
          generation_context: Json
          id: string
          intensity_zone: string | null
          promoted_to_template_id: string | null
          rating_count: number | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          similar_to_template_id: string | null
          similarity_score: number | null
          source_plan_id: string | null
          status: string
          times_completed: number | null
          times_generated: number | null
          updated_at: string | null
          workout_description: string
          workout_type: string
        }
        Insert: {
          average_rating?: number | null
          coaching_notes?: string | null
          completion_rate?: number | null
          created_at?: string | null
          duration_minutes?: number | null
          generated_by_user_id?: string | null
          generation_context?: Json
          id?: string
          intensity_zone?: string | null
          promoted_to_template_id?: string | null
          rating_count?: number | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          similar_to_template_id?: string | null
          similarity_score?: number | null
          source_plan_id?: string | null
          status?: string
          times_completed?: number | null
          times_generated?: number | null
          updated_at?: string | null
          workout_description: string
          workout_type: string
        }
        Update: {
          average_rating?: number | null
          coaching_notes?: string | null
          completion_rate?: number | null
          created_at?: string | null
          duration_minutes?: number | null
          generated_by_user_id?: string | null
          generation_context?: Json
          id?: string
          intensity_zone?: string | null
          promoted_to_template_id?: string | null
          rating_count?: number | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          similar_to_template_id?: string | null
          similarity_score?: number | null
          source_plan_id?: string | null
          status?: string
          times_completed?: number | null
          times_generated?: number | null
          updated_at?: string | null
          workout_description?: string
          workout_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_workout_candidates_generated_by_user_id_fkey"
            columns: ["generated_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "generated_workout_candidates_promoted_to_template_id_fkey"
            columns: ["promoted_to_template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_workout_candidates_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "generated_workout_candidates_similar_to_template_id_fkey"
            columns: ["similar_to_template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_workout_candidates_source_plan_id_fkey"
            columns: ["source_plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      group_assignments: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          instructions: string | null
          org_id: string | null
          scheduled_date: string
          team_id: string | null
          template_id: string
          title: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          instructions?: string | null
          org_id?: string | null
          scheduled_date: string
          team_id?: string | null
          template_id: string
          title?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          instructions?: string | null
          org_id?: string | null
          scheduled_date?: string
          team_id?: string | null
          template_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_assignments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          id: string
          joined_at: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          invite_code: string
          name: string
          performance_tier_rubric: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          invite_code: string
          name: string
          performance_tier_rubric?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          invite_code?: string
          name?: string
          performance_tier_rubric?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      pacing_recommendations: {
        Row: {
          baseline_adjustment: number | null
          confidence_level: string
          created_at: string | null
          cross_zone_adjustment: number | null
          data_sources: string[]
          hr_max: number | null
          hr_min: number | null
          id: string
          recommendation_basis: string | null
          rpe_range: string | null
          split_max: number
          split_min: number
          split_target: number
          spm_range: string | null
          total_adjustment: number | null
          user_id: string
          user_override_at: string | null
          user_override_reason: string | null
          user_override_split: number | null
          workout_date: string
          workout_zone: string
          zone_history_adjustment: number | null
        }
        Insert: {
          baseline_adjustment?: number | null
          confidence_level: string
          created_at?: string | null
          cross_zone_adjustment?: number | null
          data_sources?: string[]
          hr_max?: number | null
          hr_min?: number | null
          id?: string
          recommendation_basis?: string | null
          rpe_range?: string | null
          split_max: number
          split_min: number
          split_target: number
          spm_range?: string | null
          total_adjustment?: number | null
          user_id: string
          user_override_at?: string | null
          user_override_reason?: string | null
          user_override_split?: number | null
          workout_date: string
          workout_zone: string
          zone_history_adjustment?: number | null
        }
        Update: {
          baseline_adjustment?: number | null
          confidence_level?: string
          created_at?: string | null
          cross_zone_adjustment?: number | null
          data_sources?: string[]
          hr_max?: number | null
          hr_min?: number | null
          id?: string
          recommendation_basis?: string | null
          rpe_range?: string | null
          split_max?: number
          split_min?: number
          split_target?: number
          spm_range?: string | null
          total_adjustment?: number | null
          user_id?: string
          user_override_at?: string | null
          user_override_reason?: string | null
          user_override_split?: number | null
          workout_date?: string
          workout_zone?: string
          zone_history_adjustment?: number | null
        }
        Relationships: []
      }
      plan_adaptations: {
        Row: {
          adaptation_type: string
          analysis_data: Json | null
          applied_at: string | null
          changes: Json
          coach_modifications: Json | null
          created_at: string | null
          id: string
          plan_id: string
          proposed_at: string | null
          proposed_by: string | null
          reasoning: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          updated_at: string | null
          week_number: number
        }
        Insert: {
          adaptation_type: string
          analysis_data?: Json | null
          applied_at?: string | null
          changes: Json
          coach_modifications?: Json | null
          created_at?: string | null
          id?: string
          plan_id: string
          proposed_at?: string | null
          proposed_by?: string | null
          reasoning: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
          week_number: number
        }
        Update: {
          adaptation_type?: string
          analysis_data?: Json | null
          applied_at?: string | null
          changes?: Json
          coach_modifications?: Json | null
          created_at?: string | null
          id?: string
          plan_id?: string
          proposed_at?: string | null
          proposed_by?: string | null
          reasoning?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_adaptations_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_phases: {
        Row: {
          created_at: string | null
          description: string | null
          end_week: number
          id: string
          phase_name: string
          phase_number: number
          plan_id: string
          start_week: number
          training_focus: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_week: number
          id?: string
          phase_name: string
          phase_number: number
          plan_id: string
          start_week: number
          training_focus?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_week?: number
          id?: string
          phase_name?: string
          phase_number?: number
          plan_id?: string
          start_week?: number
          training_focus?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_phases_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_weeks: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          phase_id: string | null
          plan_id: string
          updated_at: string | null
          week_end_date: string
          week_number: number
          week_start_date: string
          weekly_volume_actual: number | null
          weekly_volume_target: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          phase_id?: string | null
          plan_id: string
          updated_at?: string | null
          week_end_date: string
          week_number: number
          week_start_date: string
          weekly_volume_actual?: number | null
          weekly_volume_target?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          phase_id?: string | null
          plan_id?: string
          updated_at?: string | null
          week_end_date?: string
          week_number?: number
          week_start_date?: string
          weekly_volume_actual?: number | null
          weekly_volume_target?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_weeks_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "plan_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_weeks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_workouts: {
        Row: {
          completed_log_id: string | null
          created_at: string | null
          custom_notes: string | null
          day_of_week: number
          drill_id: string | null
          id: string
          is_completed: boolean | null
          plan_id: string
          updated_at: string | null
          week_id: string
          workout_date: string
          workout_order: number | null
          workout_template_id: string | null
        }
        Insert: {
          completed_log_id?: string | null
          created_at?: string | null
          custom_notes?: string | null
          day_of_week: number
          drill_id?: string | null
          id?: string
          is_completed?: boolean | null
          plan_id: string
          updated_at?: string | null
          week_id: string
          workout_date: string
          workout_order?: number | null
          workout_template_id?: string | null
        }
        Update: {
          completed_log_id?: string | null
          created_at?: string | null
          custom_notes?: string | null
          day_of_week?: number
          drill_id?: string | null
          id?: string
          is_completed?: boolean | null
          plan_id?: string
          updated_at?: string | null
          week_id?: string
          workout_date?: string
          workout_order?: number | null
          workout_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_workouts_completed_log_id_fkey"
            columns: ["completed_log_id"]
            isOneToOne: false
            referencedRelation: "workout_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_workouts_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "drills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_workouts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_workouts_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "plan_weeks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_workouts_workout_template_id_fkey"
            columns: ["workout_template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sso_handoffs: {
        Row: {
          consumed_at: string | null
          consumed_by_user_id: string | null
          created_at: string
          expires_at: string
          handoff_token: string
          id: string
          initiator_user_id: string
          requested_return_to: string | null
          source_app: string
          status: string
          target_app: string
        }
        Insert: {
          consumed_at?: string | null
          consumed_by_user_id?: string | null
          created_at?: string
          expires_at?: string
          handoff_token?: string
          id?: string
          initiator_user_id: string
          requested_return_to?: string | null
          source_app: string
          status?: string
          target_app: string
        }
        Update: {
          consumed_at?: string | null
          consumed_by_user_id?: string | null
          created_at?: string
          expires_at?: string
          handoff_token?: string
          id?: string
          initiator_user_id?: string
          requested_return_to?: string | null
          source_app?: string
          status?: string
          target_app?: string
        }
        Relationships: []
      }
      strength_exercises: {
        Row: {
          created_at: string | null
          id: string
          placeholder_column: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          placeholder_column?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          placeholder_column?: string | null
        }
        Relationships: []
      }
      strength_templates: {
        Row: {
          created_at: string | null
          id: string
          placeholder_column: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          placeholder_column?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          placeholder_column?: string | null
        }
        Relationships: []
      }
      team_athletes: {
        Row: {
          athlete_id: string
          id: string
          joined_at: string
          left_at: string | null
          performance_tier: string | null
          squad: string | null
          status: string
          team_id: string
        }
        Insert: {
          athlete_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          performance_tier?: string | null
          squad?: string | null
          status?: string
          team_id: string
        }
        Update: {
          athlete_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          performance_tier?: string | null
          squad?: string | null
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_athletes_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_athletes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_leaderboard_shares: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          filter_squad: string | null
          filter_team_id: string | null
          filter_tier: string | null
          id: string
          org_id: string | null
          revoked_at: string | null
          team_id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          filter_squad?: string | null
          filter_team_id?: string | null
          filter_tier?: string | null
          id?: string
          org_id?: string | null
          revoked_at?: string | null
          team_id: string
          token_hash: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          filter_squad?: string | null
          filter_team_id?: string | null
          filter_tier?: string | null
          id?: string
          org_id?: string | null
          revoked_at?: string | null
          team_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_leaderboard_shares_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_leaderboard_shares_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          joined_at: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      teams: {
        Row: {
          coach_id: string
          created_at: string
          description: string | null
          id: string
          invite_code: string
          is_public: boolean
          max_members: number
          name: string
          org_id: string | null
          titan_power_weight: number
          titan_window_size: number
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          description?: string | null
          id?: string
          invite_code: string
          is_public?: boolean
          max_members?: number
          name: string
          org_id?: string | null
          titan_power_weight?: number
          titan_window_size?: number
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          description?: string | null
          id?: string
          invite_code?: string
          is_public?: boolean
          max_members?: number
          name?: string
          org_id?: string | null
          titan_power_weight?: number
          titan_window_size?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      template_ratings: {
        Row: {
          clarity_rating: number | null
          completion_count: number | null
          created_at: string | null
          difficulty_rating: number | null
          effectiveness_rating: number | null
          id: string
          overall_rating: number
          review_text: string | null
          template_id: string
          updated_at: string | null
          user_experience_level: string | null
          user_id: string
          would_recommend: boolean | null
        }
        Insert: {
          clarity_rating?: number | null
          completion_count?: number | null
          created_at?: string | null
          difficulty_rating?: number | null
          effectiveness_rating?: number | null
          id?: string
          overall_rating: number
          review_text?: string | null
          template_id: string
          updated_at?: string | null
          user_experience_level?: string | null
          user_id: string
          would_recommend?: boolean | null
        }
        Update: {
          clarity_rating?: number | null
          completion_count?: number | null
          created_at?: string | null
          difficulty_rating?: number | null
          effectiveness_rating?: number | null
          id?: string
          overall_rating?: number
          review_text?: string | null
          template_id?: string
          updated_at?: string | null
          user_experience_level?: string | null
          user_id?: string
          would_recommend?: boolean | null
        }
        Relationships: []
      }
      template_usage_events: {
        Row: {
          created_at: string | null
          device_type: string | null
          event_type: string
          id: string
          session_id: string | null
          template_id: string
          user_experience_level: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          device_type?: string | null
          event_type: string
          id?: string
          session_id?: string | null
          template_id: string
          user_experience_level?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          device_type?: string | null
          event_type?: string
          id?: string
          session_id?: string | null
          template_id?: string
          user_experience_level?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      training_plan_ratings: {
        Row: {
          clarity_rating: number | null
          completion_percentage: number | null
          created_at: string | null
          goal_achieved: boolean | null
          id: string
          overall_rating: number
          plan_id: string
          progression_rating: number | null
          review_text: string | null
          structure_rating: number | null
          updated_at: string | null
          user_experience_level: string | null
          user_id: string
          would_recommend: boolean | null
        }
        Insert: {
          clarity_rating?: number | null
          completion_percentage?: number | null
          created_at?: string | null
          goal_achieved?: boolean | null
          id?: string
          overall_rating: number
          plan_id: string
          progression_rating?: number | null
          review_text?: string | null
          structure_rating?: number | null
          updated_at?: string | null
          user_experience_level?: string | null
          user_id: string
          would_recommend?: boolean | null
        }
        Update: {
          clarity_rating?: number | null
          completion_percentage?: number | null
          created_at?: string | null
          goal_achieved?: boolean | null
          id?: string
          overall_rating?: number
          plan_id?: string
          progression_rating?: number | null
          review_text?: string | null
          structure_rating?: number | null
          updated_at?: string | null
          user_experience_level?: string | null
          user_id?: string
          would_recommend?: boolean | null
        }
        Relationships: []
      }
      training_plans: {
        Row: {
          activated_at: string | null
          assigned_by: string | null
          completed_at: string | null
          completion_percentage: number | null
          created_at: string
          current_week: number | null
          end_date: string
          generation_context: Json | null
          generation_job_id: string | null
          goal: string
          hours_per_week: number
          id: string
          modification_reason: string | null
          name: string
          original_plan_id: string | null
          plan_data: Json
          plan_type: string | null
          start_date: string
          status: string
          team_id: string | null
          updated_at: string
          user_id: string
          weeks_duration: number
          workouts_extracted: boolean | null
        }
        Insert: {
          activated_at?: string | null
          assigned_by?: string | null
          completed_at?: string | null
          completion_percentage?: number | null
          created_at?: string
          current_week?: number | null
          end_date: string
          generation_context?: Json | null
          generation_job_id?: string | null
          goal: string
          hours_per_week: number
          id?: string
          modification_reason?: string | null
          name: string
          original_plan_id?: string | null
          plan_data: Json
          plan_type?: string | null
          start_date: string
          status?: string
          team_id?: string | null
          updated_at?: string
          user_id: string
          weeks_duration: number
          workouts_extracted?: boolean | null
        }
        Update: {
          activated_at?: string | null
          assigned_by?: string | null
          completed_at?: string | null
          completion_percentage?: number | null
          created_at?: string
          current_week?: number | null
          end_date?: string
          generation_context?: Json | null
          generation_job_id?: string | null
          goal?: string
          hours_per_week?: number
          id?: string
          modification_reason?: string | null
          name?: string
          original_plan_id?: string | null
          plan_data?: Json
          plan_type?: string | null
          start_date?: string
          status?: string
          team_id?: string | null
          updated_at?: string
          user_id?: string
          weeks_duration?: number
          workouts_extracted?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "training_plans_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "training_plans_generation_job_id_fkey"
            columns: ["generation_job_id"]
            isOneToOne: false
            referencedRelation: "content_review_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_plans_original_plan_id_fkey"
            columns: ["original_plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_baseline_metrics: {
        Row: {
          created_at: string | null
          estimated_hr_max: number | null
          fitness_level: string | null
          hr_max_date: string | null
          hr_max_source: string | null
          last_updated: string | null
          pr_10k_date: string | null
          pr_10k_time: number | null
          pr_2k_date: string | null
          pr_2k_split: number | null
          pr_2k_time: number | null
          pr_2k_watts: number | null
          pr_500m_date: string | null
          pr_500m_time: number | null
          pr_6k_date: string | null
          pr_6k_split: number | null
          pr_6k_time: number | null
          test_history: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          estimated_hr_max?: number | null
          fitness_level?: string | null
          hr_max_date?: string | null
          hr_max_source?: string | null
          last_updated?: string | null
          pr_10k_date?: string | null
          pr_10k_time?: number | null
          pr_2k_date?: string | null
          pr_2k_split?: number | null
          pr_2k_time?: number | null
          pr_2k_watts?: number | null
          pr_500m_date?: string | null
          pr_500m_time?: number | null
          pr_6k_date?: string | null
          pr_6k_split?: number | null
          pr_6k_time?: number | null
          test_history?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          estimated_hr_max?: number | null
          fitness_level?: string | null
          hr_max_date?: string | null
          hr_max_source?: string | null
          last_updated?: string | null
          pr_10k_date?: string | null
          pr_10k_time?: number | null
          pr_2k_date?: string | null
          pr_2k_split?: number | null
          pr_2k_time?: number | null
          pr_2k_watts?: number | null
          pr_500m_date?: string | null
          pr_500m_time?: number | null
          pr_6k_date?: string | null
          pr_6k_split?: number | null
          pr_6k_time?: number | null
          test_history?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          admin_response: string | null
          admin_response_at: string | null
          created_at: string
          feedback_type: string
          id: string
          message: string
          status: string
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          admin_response_at?: string | null
          created_at?: string
          feedback_type: string
          id?: string
          message: string
          status?: string
          user_id: string
        }
        Update: {
          admin_response?: string | null
          admin_response_at?: string | null
          created_at?: string
          feedback_type?: string
          id?: string
          message?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      user_goals: {
        Row: {
          created_at: string | null
          deadline: string | null
          id: string
          is_active: boolean | null
          metric_key: string | null
          start_date: string | null
          target_value: number
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          deadline?: string | null
          id?: string
          is_active?: boolean | null
          metric_key?: string | null
          start_date?: string | null
          target_value: number
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          deadline?: string | null
          id?: string
          is_active?: boolean | null
          metric_key?: string | null
          start_date?: string | null
          target_value?: number
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_integrations: {
        Row: {
          concept2_expires_at: string | null
          concept2_refresh_token: string | null
          concept2_token: string | null
          concept2_user_id: string | null
          created_at: string | null
          google_sheet_id: string | null
          last_export_at: string | null
          user_id: string
        }
        Insert: {
          concept2_expires_at?: string | null
          concept2_refresh_token?: string | null
          concept2_token?: string | null
          concept2_user_id?: string | null
          created_at?: string | null
          google_sheet_id?: string | null
          last_export_at?: string | null
          user_id: string
        }
        Update: {
          concept2_expires_at?: string | null
          concept2_refresh_token?: string | null
          concept2_token?: string | null
          concept2_user_id?: string | null
          created_at?: string | null
          google_sheet_id?: string | null
          last_export_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          admin_signup_notified_at: string | null
          avatar_url: string | null
          baseline_tests: Json | null
          benchmark_preferences: Json | null
          bio: string | null
          birth_date: string | null
          birth_year: number | null
          certifications: Json | null
          coach_level: string | null
          created_at: string | null
          current_streak_days: number | null
          daily_recommendation: Json | null
          display_name: string
          email: string | null
          exported_at: string | null
          gender: string | null
          height_cm: number | null
          id: string
          last_active_at: string | null
          longest_streak_days: number | null
          max_heart_rate: number | null
          personal_records: Json | null
          plan_start_date: string | null
          points_goal_percentage: number | null
          preferences: Json | null
          profile_visibility: string | null
          resting_heart_rate: number | null
          roles: string[] | null
          rowing_experience_years: number | null
          rowing_sides: string | null
          share_progress: boolean | null
          share_workouts: boolean | null
          skill_level: string | null
          source: string | null
          specializations: string[] | null
          start_date: string | null
          steady_state_duration: number | null
          total_distance_meters: number | null
          total_time_minutes: number | null
          total_workouts: number | null
          updated_at: string | null
          user_id: string
          validation_stats: Json | null
          weight_kg: number | null
          weight_lbs: number | null
          years_coaching: number | null
        }
        Insert: {
          admin_signup_notified_at?: string | null
          avatar_url?: string | null
          baseline_tests?: Json | null
          benchmark_preferences?: Json | null
          bio?: string | null
          birth_date?: string | null
          birth_year?: number | null
          certifications?: Json | null
          coach_level?: string | null
          created_at?: string | null
          current_streak_days?: number | null
          daily_recommendation?: Json | null
          display_name: string
          email?: string | null
          exported_at?: string | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          last_active_at?: string | null
          longest_streak_days?: number | null
          max_heart_rate?: number | null
          personal_records?: Json | null
          plan_start_date?: string | null
          points_goal_percentage?: number | null
          preferences?: Json | null
          profile_visibility?: string | null
          resting_heart_rate?: number | null
          roles?: string[] | null
          rowing_experience_years?: number | null
          rowing_sides?: string | null
          share_progress?: boolean | null
          share_workouts?: boolean | null
          skill_level?: string | null
          source?: string | null
          specializations?: string[] | null
          start_date?: string | null
          steady_state_duration?: number | null
          total_distance_meters?: number | null
          total_time_minutes?: number | null
          total_workouts?: number | null
          updated_at?: string | null
          user_id: string
          validation_stats?: Json | null
          weight_kg?: number | null
          weight_lbs?: number | null
          years_coaching?: number | null
        }
        Update: {
          admin_signup_notified_at?: string | null
          avatar_url?: string | null
          baseline_tests?: Json | null
          benchmark_preferences?: Json | null
          bio?: string | null
          birth_date?: string | null
          birth_year?: number | null
          certifications?: Json | null
          coach_level?: string | null
          created_at?: string | null
          current_streak_days?: number | null
          daily_recommendation?: Json | null
          display_name?: string
          email?: string | null
          exported_at?: string | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          last_active_at?: string | null
          longest_streak_days?: number | null
          max_heart_rate?: number | null
          personal_records?: Json | null
          plan_start_date?: string | null
          points_goal_percentage?: number | null
          preferences?: Json | null
          profile_visibility?: string | null
          resting_heart_rate?: number | null
          roles?: string[] | null
          rowing_experience_years?: number | null
          rowing_sides?: string | null
          share_progress?: boolean | null
          share_workouts?: boolean | null
          skill_level?: string | null
          source?: string | null
          specializations?: string[] | null
          start_date?: string | null
          steady_state_duration?: number | null
          total_distance_meters?: number | null
          total_time_minutes?: number | null
          total_workouts?: number | null
          updated_at?: string | null
          user_id?: string
          validation_stats?: Json | null
          weight_kg?: number | null
          weight_lbs?: number | null
          years_coaching?: number | null
        }
        Relationships: []
      }
      workout_logs: {
        Row: {
          average_heart_rate: number | null
          average_stroke_rate: number | null
          avg_split_500m: number | null
          c2_published_at: string | null
          calories_burned: number | null
          canonical_name: string | null
          canonical_signature: string | null
          completed_at: string
          created_at: string | null
          distance_meters: number | null
          duration_minutes: number | null
          duration_seconds: number | null
          external_id: string | null
          id: string
          manual_rwn: string | null
          match_confidence: number | null
          match_reason: string | null
          max_heart_rate: number | null
          notes: string | null
          perceived_exertion: number | null
          rating: number | null
          raw_data: Json | null
          rest_distance_meters: number | null
          source: string | null
          template_id: string | null
          training_zone: string | null
          updated_at: string | null
          user_id: string
          watts: number | null
          workout_name: string
          workout_type: string
          zone_distribution: Json | null
        }
        Insert: {
          average_heart_rate?: number | null
          average_stroke_rate?: number | null
          avg_split_500m?: number | null
          c2_published_at?: string | null
          calories_burned?: number | null
          canonical_name?: string | null
          canonical_signature?: string | null
          completed_at: string
          created_at?: string | null
          distance_meters?: number | null
          duration_minutes?: number | null
          duration_seconds?: number | null
          external_id?: string | null
          id?: string
          manual_rwn?: string | null
          match_confidence?: number | null
          match_reason?: string | null
          max_heart_rate?: number | null
          notes?: string | null
          perceived_exertion?: number | null
          rating?: number | null
          raw_data?: Json | null
          rest_distance_meters?: number | null
          source?: string | null
          template_id?: string | null
          training_zone?: string | null
          updated_at?: string | null
          user_id: string
          watts?: number | null
          workout_name: string
          workout_type: string
          zone_distribution?: Json | null
        }
        Update: {
          average_heart_rate?: number | null
          average_stroke_rate?: number | null
          avg_split_500m?: number | null
          c2_published_at?: string | null
          calories_burned?: number | null
          canonical_name?: string | null
          canonical_signature?: string | null
          completed_at?: string
          created_at?: string | null
          distance_meters?: number | null
          duration_minutes?: number | null
          duration_seconds?: number | null
          external_id?: string | null
          id?: string
          manual_rwn?: string | null
          match_confidence?: number | null
          match_reason?: string | null
          max_heart_rate?: number | null
          notes?: string | null
          perceived_exertion?: number | null
          rating?: number | null
          raw_data?: Json | null
          rest_distance_meters?: number | null
          source?: string | null
          template_id?: string | null
          training_zone?: string | null
          updated_at?: string | null
          user_id?: string
          watts?: number | null
          workout_name?: string
          workout_type?: string
          zone_distribution?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      workout_power_distribution: {
        Row: {
          buckets: Json
          created_at: string | null
          workout_id: string
        }
        Insert: {
          buckets: Json
          created_at?: string | null
          workout_id: string
        }
        Update: {
          buckets?: Json
          created_at?: string | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_power_distribution_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: true
            referencedRelation: "workout_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_template_proposals: {
        Row: {
          admin_notified_at: string | null
          attribution_contact: string | null
          attribution_name: string | null
          created_at: string
          description: string
          difficulty_level: string
          duplicate_template_id: string | null
          id: string
          name: string
          notes: string | null
          promoted_template_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          rwn: string
          status: string
          submitted_by_user_id: string | null
          training_zone: string | null
          updated_at: string
          workout_structure: Json | null
          workout_type: string
        }
        Insert: {
          admin_notified_at?: string | null
          attribution_contact?: string | null
          attribution_name?: string | null
          created_at?: string
          description?: string
          difficulty_level?: string
          duplicate_template_id?: string | null
          id?: string
          name: string
          notes?: string | null
          promoted_template_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rwn: string
          status?: string
          submitted_by_user_id?: string | null
          training_zone?: string | null
          updated_at?: string
          workout_structure?: Json | null
          workout_type?: string
        }
        Update: {
          admin_notified_at?: string | null
          attribution_contact?: string | null
          attribution_name?: string | null
          created_at?: string
          description?: string
          difficulty_level?: string
          duplicate_template_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          promoted_template_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rwn?: string
          status?: string
          submitted_by_user_id?: string | null
          training_zone?: string | null
          updated_at?: string
          workout_structure?: Json | null
          workout_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_template_proposals_duplicate_template_id_fkey"
            columns: ["duplicate_template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_template_proposals_promoted_template_id_fkey"
            columns: ["promoted_template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_templates: {
        Row: {
          average_rating: number | null
          canonical_name: string | null
          coaching_points: string[] | null
          completion_rate: number | null
          created_at: string | null
          created_by: string | null
          description: string
          difficulty_level: string | null
          distance: number | null
          estimated_duration: number | null
          id: string
          is_interval: boolean | null
          is_steady_state: boolean | null
          is_test: boolean | null
          last_used_at: string | null
          name: string
          pacing_guidance: string | null
          rating_count: number | null
          rwn: string | null
          status: string | null
          tags: string[] | null
          technique_focus: string[] | null
          training_zone: string | null
          updated_at: string | null
          usage_count: number | null
          validated: boolean | null
          workout_category: string | null
          workout_structure: Json | null
          workout_type: string
        }
        Insert: {
          average_rating?: number | null
          canonical_name?: string | null
          coaching_points?: string[] | null
          completion_rate?: number | null
          created_at?: string | null
          created_by?: string | null
          description: string
          difficulty_level?: string | null
          distance?: number | null
          estimated_duration?: number | null
          id?: string
          is_interval?: boolean | null
          is_steady_state?: boolean | null
          is_test?: boolean | null
          last_used_at?: string | null
          name: string
          pacing_guidance?: string | null
          rating_count?: number | null
          rwn?: string | null
          status?: string | null
          tags?: string[] | null
          technique_focus?: string[] | null
          training_zone?: string | null
          updated_at?: string | null
          usage_count?: number | null
          validated?: boolean | null
          workout_category?: string | null
          workout_structure?: Json | null
          workout_type: string
        }
        Update: {
          average_rating?: number | null
          canonical_name?: string | null
          coaching_points?: string[] | null
          completion_rate?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          difficulty_level?: string | null
          distance?: number | null
          estimated_duration?: number | null
          id?: string
          is_interval?: boolean | null
          is_steady_state?: boolean | null
          is_test?: boolean | null
          last_used_at?: string | null
          name?: string
          pacing_guidance?: string | null
          rating_count?: number | null
          rwn?: string | null
          status?: string | null
          tags?: string[] | null
          technique_focus?: string[] | null
          training_zone?: string | null
          updated_at?: string | null
          usage_count?: number | null
          validated?: boolean | null
          workout_category?: string | null
          workout_structure?: Json | null
          workout_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      drill_ratings_summary: {
        Row: {
          avg_clarity_rating: number | null
          avg_difficulty_rating: number | null
          avg_effectiveness_rating: number | null
          avg_overall_rating: number | null
          drill_id: string | null
          improvement_rate: number | null
          negative_reviews: number | null
          positive_reviews: number | null
          recommendation_rate: number | null
          review_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "drill_ratings_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "drills"
            referencedColumns: ["id"]
          },
        ]
      }
      training_plan_ratings_summary: {
        Row: {
          avg_clarity_rating: number | null
          avg_completion_percentage: number | null
          avg_overall_rating: number | null
          avg_progression_rating: number | null
          avg_structure_rating: number | null
          goal_achievement_rate: number | null
          negative_reviews: number | null
          plan_id: string | null
          positive_reviews: number | null
          recommendation_rate: number | null
          review_count: number | null
        }
        Relationships: []
      }
      workout_template_ratings_summary: {
        Row: {
          avg_clarity_rating: number | null
          avg_difficulty_rating: number | null
          avg_effectiveness_rating: number | null
          avg_overall_rating: number | null
          negative_reviews: number | null
          positive_reviews: number | null
          recommendation_rate: number | null
          review_count: number | null
          template_id: string | null
        }
        Relationships: []
      }
      zone_performance_history: {
        Row: {
          avg_heart_rate: number | null
          avg_rpe: number | null
          avg_split: number | null
          avg_spm: number | null
          best_split: number | null
          calculated_at: string | null
          consistency_score: number | null
          last_workout_date: string | null
          lookback_days: number | null
          split_trend: string | null
          total_meters: number | null
          user_id: string | null
          workout_count: number | null
          worst_split: number | null
          zone: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Functions: {
      add_baseline_test: {
        Args: {
          p_distance_meters?: number
          p_hr_avg?: number
          p_hr_max?: number
          p_notes?: string
          p_stroke_rate_avg?: number
          p_test_date: string
          p_test_type: string
          p_time_seconds: number
          p_user_id: string
          p_watts_avg?: number
        }
        Returns: Json
      }
      approve_coaching_request: {
        Args: { new_status: string; request_id: string }
        Returns: Json
      }
      calculate_split_500m: {
        Args: { distance_meters: number; duration_minutes: number }
        Returns: number
      }
      can_coach_athlete: {
        Args: { p_athlete_id: string; p_user_id: string }
        Returns: boolean
      }
      can_coach_team: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: boolean
      }
      can_create_teams: { Args: { p_user_id: string }; Returns: boolean }
      can_manage_team_members: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: boolean
      }
      can_staff_team: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: boolean
      }
      can_view_athlete: {
        Args: { p_athlete_id: string; p_user_id: string }
        Returns: boolean
      }
      can_view_team: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: boolean
      }
      categorize_coaching_point: {
        Args: { point: string }
        Returns: Database["public"]["Enums"]["coaching_category"]
      }
      consume_sso_handoff: {
        Args: {
          p_consumer_user_id?: string
          p_expected_target: string
          p_token: string
        }
        Returns: {
          initiator_user_id: string
          requested_return_to: string
          source_app: string
          target_app: string
        }[]
      }
      create_assignment_results_share: {
        Args: { p_expires_in_hours?: number; p_group_assignment_id: string }
        Returns: Json
      }
      create_sso_handoff: {
        Args: {
          p_return_to?: string
          p_source_app: string
          p_target_app: string
          p_ttl_seconds?: number
        }
        Returns: string
      }
      create_team_leaderboard_share: {
        Args: {
          p_expires_in_hours?: number
          p_filter_squad?: string
          p_filter_team_id?: string
          p_filter_tier?: string
          p_org_id?: string
          p_team_id: string
        }
        Returns: Json
      }
      ensure_team_member_athlete_link: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: string
      }
      extract_technique_focus: {
        Args: { description: string; workout_type: string }
        Returns: Database["public"]["Enums"]["technique_focus"][]
      }
      find_eligible_coaches: {
        Args: {
          p_content_type: string
          p_min_coach_level?: string
          p_required_specializations?: string[]
        }
        Returns: {
          approval_rate: number
          avg_review_time: number
          coach_id: string
          coach_level: string
          current_queue_count: number
          specializations: string[]
          years_coaching: number
        }[]
      }
      get_active_plan: {
        Args: { p_user_id: string }
        Returns: {
          current_week: number
          end_date: string
          plan_data: Json
          plan_id: string
          start_date: string
        }[]
      }
      get_coach_approval_rate: { Args: { p_coach_id: string }; Returns: number }
      increment_template_usage: {
        Args: { template_id: string }
        Returns: undefined
      }
      is_org_member: { Args: { p_org_id: string }; Returns: boolean }
      is_org_owner_or_admin: { Args: { p_org_id: string }; Returns: boolean }
      lookup_team_by_invite_code: {
        Args: { p_code: string }
        Returns: {
          coach_id: string
          created_at: string
          description: string | null
          id: string
          invite_code: string
          is_public: boolean
          max_members: number
          name: string
          org_id: string | null
          titan_power_weight: number
          titan_window_size: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "teams"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      map_workout_category: { Args: { legacy_type: string }; Returns: string }
      refresh_zone_performance_history: { Args: never; Returns: undefined }
      resolve_assignment_results_share: {
        Args: { p_token: string }
        Returns: Json
      }
      resolve_team_leaderboard_share: {
        Args: { p_token: string }
        Returns: Json
      }
      update_coach_validation_stats: {
        Args: {
          p_coach_id: string
          p_review_duration_minutes: number
          p_review_status: string
        }
        Returns: undefined
      }
      user_has_role: { Args: { required_role: string }; Returns: boolean }
    }
    Enums: {
      coaching_category:
        | "technique"
        | "pacing"
        | "mindset"
        | "safety"
        | "progression"
        | "common_mistakes"
      content_status: "draft" | "review" | "approved" | "published" | "archived"
      technique_focus:
        | "catch_timing"
        | "drive_power"
        | "finish_technique"
        | "recovery_flow"
        | "posture_alignment"
        | "breathing_rhythm"
        | "rate_control"
        | "power_application"
        | "blade_work"
        | "timing_synchronization"
        | "core_stability"
        | "leg_drive"
        | "handle_work"
        | "body_swing"
        | "slide_control"
        | "mental_focus"
      training_zone:
        | "UT2"
        | "UT1"
        | "AT"
        | "TR"
        | "AN"
        | "MAX"
        | "Recovery"
        | "Mixed"
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
  public: {
    Enums: {
      coaching_category: [
        "technique",
        "pacing",
        "mindset",
        "safety",
        "progression",
        "common_mistakes",
      ],
      content_status: ["draft", "review", "approved", "published", "archived"],
      technique_focus: [
        "catch_timing",
        "drive_power",
        "finish_technique",
        "recovery_flow",
        "posture_alignment",
        "breathing_rhythm",
        "rate_control",
        "power_application",
        "blade_work",
        "timing_synchronization",
        "core_stability",
        "leg_drive",
        "handle_work",
        "body_swing",
        "slide_control",
        "mental_focus",
      ],
      training_zone: [
        "UT2",
        "UT1",
        "AT",
        "TR",
        "AN",
        "MAX",
        "Recovery",
        "Mixed",
      ],
    },
  },
} as const
