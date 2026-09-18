// Auto-generated from Supabase schema via the MCP `generate_typescript_types`
// tool. Regenerate after any DDL changes:
//   npx supabase gen types typescript --project-id fyhjusydcmbcsisflmao
// (or via the Supabase MCP tool from a Claude session).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.1";
  };
  public: {
    Tables: {
      comment_votes: {
        Row: {
          comment_id: string;
          created_at: string;
          updated_at: string;
          user_id: string;
          value: number;
        };
        Insert: {
          comment_id: string;
          created_at?: string;
          updated_at?: string;
          user_id: string;
          value: number;
        };
        Update: {
          comment_id?: string;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "comment_votes_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "topic_comments";
            referencedColumns: ["id"];
          },
        ];
      };
      debates: {
        Row: {
          challenged_user_id: string | null;
          completed_at: string | null;
          created_at: string;
          current_round: number;
          custom_prompt: string | null;
          debater_a_stance: string;
          debater_a_user_id: string;
          debater_b_stance: string | null;
          debater_b_user_id: string | null;
          id: string;
          opponent_selection: string;
          status: string;
          topic_id: string | null;
          turn_deadline_at: string | null;
          turn_user_id: string | null;
          updated_at: string;
          visibility: string;
        };
        Insert: {
          challenged_user_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          current_round?: number;
          custom_prompt?: string | null;
          debater_a_stance: string;
          debater_a_user_id: string;
          debater_b_stance?: never;
          debater_b_user_id?: string | null;
          id?: string;
          opponent_selection: string;
          status?: string;
          topic_id?: string | null;
          turn_deadline_at?: string | null;
          turn_user_id?: string | null;
          updated_at?: string;
          visibility?: string;
        };
        Update: {
          challenged_user_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          current_round?: number;
          custom_prompt?: string | null;
          debater_a_stance?: string;
          debater_a_user_id?: string;
          debater_b_stance?: never;
          debater_b_user_id?: string | null;
          id?: string;
          opponent_selection?: string;
          status?: string;
          topic_id?: string | null;
          turn_deadline_at?: string | null;
          turn_user_id?: string | null;
          updated_at?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "debates_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          archetype_id: string;
          axis_e: number;
          axis_g: number;
          axis_s: number;
          created_at: string;
          elo: number;
          email: string;
          handle: string;
          losses: number;
          show_on_profile: boolean;
          updated_at: string;
          user_id: string;
          wins: number;
          xp: number;
        };
        Insert: {
          archetype_id: string;
          axis_e: number;
          axis_g: number;
          axis_s: number;
          created_at?: string;
          elo?: number;
          email?: string;
          handle: string;
          losses?: number;
          show_on_profile?: boolean;
          updated_at?: string;
          user_id: string;
          wins?: number;
          xp?: number;
        };
        Update: {
          archetype_id?: string;
          axis_e?: number;
          axis_g?: number;
          axis_s?: number;
          created_at?: string;
          elo?: number;
          email?: string;
          handle?: string;
          losses?: number;
          show_on_profile?: boolean;
          updated_at?: string;
          user_id?: string;
          wins?: number;
          xp?: number;
        };
        Relationships: [];
      };
      rounds: {
        Row: {
          content: string;
          deadline_at: string;
          debate_id: string;
          id: string;
          round_number: number;
          submitted_at: string;
          user_id: string;
        };
        Insert: {
          content: string;
          deadline_at: string;
          debate_id: string;
          id?: string;
          round_number: number;
          submitted_at?: string;
          user_id: string;
        };
        Update: {
          content?: string;
          deadline_at?: string;
          debate_id?: string;
          id?: string;
          round_number?: number;
          submitted_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rounds_debate_id_fkey";
            columns: ["debate_id"];
            isOneToOne: false;
            referencedRelation: "debates";
            referencedColumns: ["id"];
          },
        ];
      };
      topic_comments: {
        Row: {
          archetype_id: string;
          body: string;
          created_at: string;
          id: string;
          is_deleted: boolean;
          parent_id: string | null;
          score: number;
          topic_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          archetype_id: string;
          body: string;
          created_at?: string;
          id?: string;
          is_deleted?: boolean;
          parent_id?: string | null;
          score?: number;
          topic_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          archetype_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          is_deleted?: boolean;
          parent_id?: string | null;
          score?: number;
          topic_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "topic_comments_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "topic_comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "topic_comments_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
        ];
      };
      topics: {
        Row: {
          background: string;
          center_sources: Json;
          created_at: string;
          debate_question: string;
          id: string;
          left_sources: Json;
          left_summary: string;
          og_image_url: string | null;
          primary_axis: string;
          published_at: string;
          right_sources: Json;
          right_summary: string;
          slug: string;
          status: string;
          tags: string[];
          title: string;
          updated_at: string;
        };
        Insert: {
          background: string;
          center_sources?: Json;
          created_at?: string;
          debate_question: string;
          id?: string;
          left_sources?: Json;
          left_summary: string;
          og_image_url?: string | null;
          primary_axis?: string;
          published_at?: string;
          right_sources?: Json;
          right_summary: string;
          slug: string;
          status?: string;
          tags?: string[];
          title: string;
          updated_at?: string;
        };
        Update: {
          background?: string;
          center_sources?: Json;
          created_at?: string;
          debate_question?: string;
          id?: string;
          left_sources?: Json;
          left_summary?: string;
          og_image_url?: string | null;
          primary_axis?: string;
          published_at?: string;
          right_sources?: Json;
          right_summary?: string;
          slug?: string;
          status?: string;
          tags?: string[];
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      topic_ingest_runs: {
        Row: {
          created_at: string;
          detail: Json;
          id: string;
          status: string;
          topic_id: string | null;
        };
        Insert: {
          created_at?: string;
          detail?: Json;
          id?: string;
          status: string;
          topic_id?: string | null;
        };
        Update: {
          created_at?: string;
          detail?: Json;
          id?: string;
          status?: string;
          topic_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "topic_ingest_runs_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
        ];
      };
      topic_votes: {
        Row: {
          archetype_id: string;
          created_at: string;
          id: string;
          topic_id: string;
          updated_at: string;
          user_id: string;
          vote: string;
        };
        Insert: {
          archetype_id: string;
          created_at?: string;
          id?: string;
          topic_id: string;
          updated_at?: string;
          user_id: string;
          vote: string;
        };
        Update: {
          archetype_id?: string;
          created_at?: string;
          id?: string;
          topic_id?: string;
          updated_at?: string;
          user_id?: string;
          vote?: string;
        };
        Relationships: [
          {
            foreignKeyName: "topic_votes_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
        ];
      };
      xp_events: {
        Row: {
          action: string;
          amount: number;
          created_at: string;
          day: string;
          id: string;
          reference_id: string | null;
          reference_type: string | null;
          user_id: string;
        };
        Insert: {
          action: string;
          amount: number;
          created_at?: string;
          day?: string;
          id?: string;
          reference_id?: string | null;
          reference_type?: string | null;
          user_id: string;
        };
        Update: {
          action?: string;
          amount?: number;
          created_at?: string;
          day?: string;
          id?: string;
          reference_id?: string | null;
          reference_type?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      accept_challenge: { Args: { p_debate_id: string }; Returns: undefined };
      cancel_challenge: { Args: { p_debate_id: string }; Returns: undefined };
      create_challenge: {
        Args: {
          p_custom_prompt?: string | null;
          p_opponent_handle?: string | null;
          p_stance: string;
          p_topic_id?: string | null;
          p_visibility?: string;
        };
        Returns: string;
      };
      debate_is_listed: {
        Args: { d: Database["public"]["Tables"]["debates"]["Row"] };
        Returns: boolean;
      };
      debates_with_debaters: {
        Args: {
          p_debate_id?: string | null;
          p_limit?: number;
          p_scope?: string;
          p_topic_id?: string | null;
        };
        Returns: {
          a_archetype_id: string | null;
          a_handle: string;
          b_archetype_id: string | null;
          b_handle: string | null;
          challenged_user_id: string | null;
          completed_at: string | null;
          created_at: string;
          current_round: number;
          debater_a_stance: string;
          debater_a_user_id: string;
          debater_b_stance: string;
          debater_b_user_id: string | null;
          id: string;
          opponent_selection: string;
          prompt: string;
          status: string;
          topic_id: string | null;
          topic_slug: string | null;
          topic_title: string | null;
          turn_deadline_at: string | null;
          turn_user_id: string | null;
          updated_at: string;
          visibility: string;
        }[];
      };
      decline_challenge: { Args: { p_debate_id: string }; Returns: undefined };
      handle_is_available: { Args: { p_handle: string }; Returns: boolean };
      handle_is_clean: { Args: { p_handle: string }; Returns: boolean };
      submit_round: {
        Args: { p_content: string; p_debate_id: string };
        Returns: undefined;
      };
      topic_comments_with_author: {
        Args: { p_limit?: number; p_sort?: string; p_topic_id: string };
        Returns: {
          archetype_id: string;
          body: string;
          created_at: string;
          handle: string;
          id: string;
          is_deleted: boolean;
          parent_id: string;
          score: number;
          show_on_profile: boolean;
        }[];
      };
      topic_vote_tally: {
        Args: { p_topic_id: string };
        Returns: {
          no_by_archetype: Json;
          no_total: number;
          yes_by_archetype: Json;
          yes_total: number;
        }[];
      };
      trigger_daily_topic: { Args: { p_body?: Json }; Returns: number };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type TopicRow = Database["public"]["Tables"]["topics"]["Row"];
export type TopicInsert = Database["public"]["Tables"]["topics"]["Insert"];
export type TopicVoteTally =
  Database["public"]["Functions"]["topic_vote_tally"]["Returns"][number];
export type CommentWithAuthor =
  Database["public"]["Functions"]["topic_comments_with_author"]["Returns"][number];
export type DebateWithDebaters =
  Database["public"]["Functions"]["debates_with_debaters"]["Returns"][number];
export type RoundRow = Database["public"]["Tables"]["rounds"]["Row"];

// Shape of a source citation inside a topic's left_sources / right_sources /
// center_sources jsonb arrays. n8n writes these via the ingest endpoint; the
// page renders them as source cards.
export interface TopicSource {
  outlet: string;
  title: string;
  url: string;
  bias_label: string; // "Left" | "Lean Left" | "Center" | "Lean Right" | "Right"
  excerpt?: string;
}
