export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          display_name: string;
          age: number;
          height_inches: number;
          location_label: string;
          location_latitude: number | null;
          location_longitude: number | null;
          gender_identity: string;
          sexual_orientation: string;
          looking_for: string[];
          dating_intentions: string[];
          queer_roles: string[];
          presentation_tags: string[];
          personality_tags: string[];
          lifestyle_tags: string[];
          verification_status: string;
          text_notifications_enabled: boolean;
          onboarded_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          first_name?: string;
          last_name?: string;
          display_name?: string;
          age?: number;
          height_inches?: number;
          location_label?: string;
          location_latitude?: number | null;
          location_longitude?: number | null;
          gender_identity?: string;
          sexual_orientation?: string;
          looking_for?: string[];
          dating_intentions?: string[];
          queer_roles?: string[];
          presentation_tags?: string[];
          personality_tags?: string[];
          lifestyle_tags?: string[];
          verification_status?: string;
          text_notifications_enabled?: boolean;
          onboarded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      profile_photos: {
        Row: {
          id: string;
          user_id: string;
          storage_path: string;
          public_url: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          storage_path: string;
          public_url?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profile_photos']['Insert']>;
      };
      dating_preferences: {
        Row: {
          user_id: string;
          age_range_min: number;
          age_range_max: number;
          height_min_inches: number;
          height_max_inches: number;
          max_distance_miles: number;
          preferred_orientations: string[];
          preferred_looking_for: string[];
          preferred_queer_roles: string[];
          preferred_presentation_tags: string[];
          dealbreakers: string[];
          nice_to_haves: string[];
          matching_priority_order: string[];
          updated_at: string;
        };
        Insert: {
          user_id: string;
          age_range_min?: number;
          age_range_max?: number;
          height_min_inches?: number;
          height_max_inches?: number;
          max_distance_miles?: number;
          preferred_orientations?: string[];
          preferred_looking_for?: string[];
          preferred_queer_roles?: string[];
          preferred_presentation_tags?: string[];
          dealbreakers?: string[];
          nice_to_haves?: string[];
          matching_priority_order?: string[];
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['dating_preferences']['Insert']>;
      };
      blocked_users: {
        Row: {
          id: string;
          blocker_id: string;
          blocked_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          blocker_id: string;
          blocked_id: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['blocked_users']['Insert']>;
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          reported_id: string;
          context: string;
          speed_date_id: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          reported_id: string;
          context: string;
          speed_date_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['reports']['Insert']>;
      };
      matches: {
        Row: {
          id: string;
          user_a_id: string;
          user_b_id: string;
          speed_date_id: string | null;
          matched_at: string;
          last_message_at: string | null;
        };
        Insert: {
          id?: string;
          user_a_id: string;
          user_b_id: string;
          speed_date_id?: string | null;
          matched_at?: string;
          last_message_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['matches']['Insert']>;
      };
      messages: {
        Row: {
          id: string;
          match_id: string;
          sender_id: string;
          text: string;
          sent_at: string;
        };
        Insert: {
          id?: string;
          match_id: string;
          sender_id: string;
          text: string;
          sent_at?: string;
        };
        Update: Partial<Database['public']['Tables']['messages']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type DatingPreferencesRow = Database['public']['Tables']['dating_preferences']['Row'];
export type BlockedUserRow = Database['public']['Tables']['blocked_users']['Row'];
