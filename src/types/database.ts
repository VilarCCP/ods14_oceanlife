
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "admin_users": {
                  Row: {
                    "created_at": string,"note": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"note"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"note"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"species": {
                  Row: {
                    "behavior": string | null,"common_name": string,"conservation_accessed_at": string | null,"conservation_assessment_year": number | null,"conservation_category": string | null,"conservation_source_url": string | null,"conservation_system": string | null,"created_at": string,"curiosities": string | null,"description": string | null,"diet": string | null,"display_group": string | null,"ecosystem_importance": string | null,"extinction_risk": string | null,"gbif_usage_key": number | null,"geographic_distribution": string | null,"habitat": string | null,"id": string,"is_featured": boolean,"is_published": boolean,"life_expectancy": string | null,"main_threats": string | null,"physical_characteristics": string | null,"published_at": string | null,"scientific_name": string,"scientific_name_normalized": string | null,"search_text": string | null,"short_description": string | null,"slug": string,"taxonomic_group": string | null,"updated_at": string,"worms_aphia_id": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "behavior"?: string | null,"common_name": string,"conservation_accessed_at"?: string | null,"conservation_assessment_year"?: number | null,"conservation_category"?: string | null,"conservation_source_url"?: string | null,"conservation_system"?: string | null,"created_at"?: string,"curiosities"?: string | null,"description"?: string | null,"diet"?: string | null,"display_group"?: string | null,"ecosystem_importance"?: string | null,"extinction_risk"?: string | null,"gbif_usage_key"?: number | null,"geographic_distribution"?: string | null,"habitat"?: string | null,"id"?: string,"is_featured"?: boolean,"is_published"?: boolean,"life_expectancy"?: string | null,"main_threats"?: string | null,"physical_characteristics"?: string | null,"published_at"?: string | null,"scientific_name": string,"scientific_name_normalized"?: never,"search_text"?: never,"short_description"?: string | null,"slug": string,"taxonomic_group"?: string | null,"updated_at"?: string,"worms_aphia_id"?: number | null
                  }
                  Update: {
                    "behavior"?: string | null,"common_name"?: string,"conservation_accessed_at"?: string | null,"conservation_assessment_year"?: number | null,"conservation_category"?: string | null,"conservation_source_url"?: string | null,"conservation_system"?: string | null,"created_at"?: string,"curiosities"?: string | null,"description"?: string | null,"diet"?: string | null,"display_group"?: string | null,"ecosystem_importance"?: string | null,"extinction_risk"?: string | null,"gbif_usage_key"?: number | null,"geographic_distribution"?: string | null,"habitat"?: string | null,"id"?: string,"is_featured"?: boolean,"is_published"?: boolean,"life_expectancy"?: string | null,"main_threats"?: string | null,"physical_characteristics"?: string | null,"published_at"?: string | null,"scientific_name"?: string,"scientific_name_normalized"?: never,"search_text"?: never,"short_description"?: string | null,"slug"?: string,"taxonomic_group"?: string | null,"updated_at"?: string,"worms_aphia_id"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "species_display_group_fkey"
      columns: ["display_group"]
isOneToOne: false
      referencedRelation: "species_groups"
      referencedColumns: ["slug"]
    }
                  ]
                },"species_groups": {
                  Row: {
                    "label": string,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "label": string,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "label"?: string,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"species_images": {
                  Row: {
                    "alt_text": string | null,"caption": string | null,"created_at": string,"credit": string | null,"display_order": number,"id": string,"is_cover": boolean,"license": string | null,"source_url": string | null,"species_id": string,"storage_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alt_text"?: string | null,"caption"?: string | null,"created_at"?: string,"credit"?: string | null,"display_order"?: number,"id"?: string,"is_cover"?: boolean,"license"?: string | null,"source_url"?: string | null,"species_id": string,"storage_path": string
                  }
                  Update: {
                    "alt_text"?: string | null,"caption"?: string | null,"created_at"?: string,"credit"?: string | null,"display_order"?: number,"id"?: string,"is_cover"?: boolean,"license"?: string | null,"source_url"?: string | null,"species_id"?: string,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "species_images_species_id_fkey"
      columns: ["species_id"]
isOneToOne: false
      referencedRelation: "species"
      referencedColumns: ["id"]
    }
                  ]
                },"species_sources": {
                  Row: {
                    "accessed_at": string,"created_at": string,"fields_imported": NonNullable<Json>,"id": string,"license_or_attribution": string | null,"notes": string | null,"provider": string,"reference_title": string | null,"source_record_id": string | null,"source_url": string | null,"species_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accessed_at": string,"created_at"?: string,"fields_imported"?: NonNullable<Json>,"id"?: string,"license_or_attribution"?: string | null,"notes"?: string | null,"provider": string,"reference_title"?: string | null,"source_record_id"?: string | null,"source_url"?: string | null,"species_id": string,"updated_at"?: string
                  }
                  Update: {
                    "accessed_at"?: string,"created_at"?: string,"fields_imported"?: NonNullable<Json>,"id"?: string,"license_or_attribution"?: string | null,"notes"?: string | null,"provider"?: string,"reference_title"?: string | null,"source_record_id"?: string | null,"source_url"?: string | null,"species_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "species_sources_species_id_fkey"
      columns: ["species_id"]
isOneToOne: false
      referencedRelation: "species"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "assert_species_publishable":
{ Args: { "p_species_id": string }; Returns: undefined
                           },
"immutable_unaccent":
{ Args: { "value": string }; Returns: string
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_valid_species_image_path":
{ Args: { "object_name": string }; Returns: boolean
                           },
"normalize_text":
{ Args: { "value": string }; Returns: string
                           },
"set_species_cover":
{ Args: { "p_image_id": string }; Returns: undefined
                           },
"species_publication_issues":
{ Args: { "p_species_id": string }; Returns: (string)[]
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
