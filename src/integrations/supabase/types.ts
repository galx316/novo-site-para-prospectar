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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      arquivos: {
        Row: {
          caminho: string
          created_at: string
          id: string
          lote_id: string | null
          mime: string | null
          nome: string
          obra_id: string | null
          registro_id: string | null
          tamanho: number | null
          updated_at: string
        }
        Insert: {
          caminho: string
          created_at?: string
          id?: string
          lote_id?: string | null
          mime?: string | null
          nome: string
          obra_id?: string | null
          registro_id?: string | null
          tamanho?: number | null
          updated_at?: string
        }
        Update: {
          caminho?: string
          created_at?: string
          id?: string
          lote_id?: string | null
          mime?: string | null
          nome?: string
          obra_id?: string | null
          registro_id?: string | null
          tamanho?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arquivos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arquivos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arquivos_registro_id_fkey"
            columns: ["registro_id"]
            isOneToOne: false
            referencedRelation: "registros"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_itens: {
        Row: {
          created_at: string
          feito: boolean
          feito_em: string | null
          id: string
          item: string
          nota: string | null
          obra_id: string
          ordem: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          feito?: boolean
          feito_em?: string | null
          id?: string
          item: string
          nota?: string | null
          obra_id: string
          ordem: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          feito?: boolean
          feito_em?: string | null
          id?: string
          item?: string
          nota?: string | null
          obra_id?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_itens_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          cidade: string | null
          cnpj: string | null
          created_at: string
          id: string
          nome: string
          nome_normalizado: string
          observacoes: string | null
          representante_prado: string | null
          situacao_prado: Database["public"]["Enums"]["situacao_prado"]
          uf: string | null
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          nome: string
          nome_normalizado: string
          observacoes?: string | null
          representante_prado?: string | null
          situacao_prado?: Database["public"]["Enums"]["situacao_prado"]
          uf?: string | null
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          nome?: string
          nome_normalizado?: string
          observacoes?: string | null
          representante_prado?: string | null
          situacao_prado?: Database["public"]["Enums"]["situacao_prado"]
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          acrescimo_ferias_dias: number
          alerta_entrega_dias: number
          atalhos_dias: number[]
          cadencia_intervalos: number[]
          cadencia_max_tentativas: number
          cadencia_pausa_dias: number
          created_at: string
          demanda_antecedencia_dias: number
          dias_tarefa_inicial: number
          ferias_fim: string | null
          ferias_inicio: string | null
          id: number
          prazos: Json
          retomar_sem_demanda_dias: number
          revisao_dias: number
          updated_at: string
        }
        Insert: {
          acrescimo_ferias_dias?: number
          alerta_entrega_dias?: number
          atalhos_dias?: number[]
          cadencia_intervalos?: number[]
          cadencia_max_tentativas?: number
          cadencia_pausa_dias?: number
          created_at?: string
          demanda_antecedencia_dias?: number
          dias_tarefa_inicial?: number
          ferias_fim?: string | null
          ferias_inicio?: string | null
          id?: number
          prazos?: Json
          retomar_sem_demanda_dias?: number
          revisao_dias?: number
          updated_at?: string
        }
        Update: {
          acrescimo_ferias_dias?: number
          alerta_entrega_dias?: number
          atalhos_dias?: number[]
          cadencia_intervalos?: number[]
          cadencia_max_tentativas?: number
          cadencia_pausa_dias?: number
          created_at?: string
          demanda_antecedencia_dias?: number
          dias_tarefa_inicial?: number
          ferias_fim?: string | null
          ferias_inicio?: string | null
          id?: number
          prazos?: Json
          retomar_sem_demanda_dias?: number
          revisao_dias?: number
          updated_at?: string
        }
        Relationships: []
      }
      contatos: {
        Row: {
          cargo: string | null
          cliente_id: string | null
          created_at: string
          email: string | null
          id: string
          nome: string
          observacoes: string | null
          tentativas_sem_resposta: number
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          cargo?: string | null
          cliente_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          tentativas_sem_resposta?: number
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          cargo?: string | null
          cliente_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          tentativas_sem_resposta?: number
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contatos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      followups: {
        Row: {
          cliente_id: string | null
          concluido_em: string | null
          contato_id: string | null
          created_at: string
          data: string
          id: string
          lote_id: string | null
          motivo: string
          obra_id: string | null
          oportunidade_id: string | null
          origem: Database["public"]["Enums"]["origem_followup"]
          status: Database["public"]["Enums"]["status_followup"]
          tentativa: number | null
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          concluido_em?: string | null
          contato_id?: string | null
          created_at?: string
          data: string
          id?: string
          lote_id?: string | null
          motivo: string
          obra_id?: string | null
          oportunidade_id?: string | null
          origem: Database["public"]["Enums"]["origem_followup"]
          status?: Database["public"]["Enums"]["status_followup"]
          tentativa?: number | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          concluido_em?: string | null
          contato_id?: string | null
          created_at?: string
          data?: string
          id?: string
          lote_id?: string | null
          motivo?: string
          obra_id?: string | null
          oportunidade_id?: string | null
          origem?: Database["public"]["Enums"]["origem_followup"]
          status?: Database["public"]["Enums"]["status_followup"]
          tentativa?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followups_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followups_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followups_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followups_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followups_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "oportunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes: {
        Row: {
          acrescimo_ferias_dias: number
          cadastro_completo: boolean
          created_at: string
          data_confirmada: string | null
          descricao: string | null
          entregue_em: string | null
          ferias_pendente: boolean
          id: string
          medido_em: string | null
          obra_id: string
          prazo_dias: number | null
          previsao_entrega: string | null
          previsao_medicao: string | null
          quantidade: number | null
          recebimento_confirmado: boolean
          responsavel_recebimento: string | null
          status: Database["public"]["Enums"]["status_lote"]
          tipo: Database["public"]["Enums"]["tipo_lote"]
          updated_at: string
        }
        Insert: {
          acrescimo_ferias_dias?: number
          cadastro_completo?: boolean
          created_at?: string
          data_confirmada?: string | null
          descricao?: string | null
          entregue_em?: string | null
          ferias_pendente?: boolean
          id?: string
          medido_em?: string | null
          obra_id: string
          prazo_dias?: number | null
          previsao_entrega?: string | null
          previsao_medicao?: string | null
          quantidade?: number | null
          recebimento_confirmado?: boolean
          responsavel_recebimento?: string | null
          status?: Database["public"]["Enums"]["status_lote"]
          tipo: Database["public"]["Enums"]["tipo_lote"]
          updated_at?: string
        }
        Update: {
          acrescimo_ferias_dias?: number
          cadastro_completo?: boolean
          created_at?: string
          data_confirmada?: string | null
          descricao?: string | null
          entregue_em?: string | null
          ferias_pendente?: boolean
          id?: string
          medido_em?: string | null
          obra_id?: string
          prazo_dias?: number | null
          previsao_entrega?: string | null
          previsao_medicao?: string | null
          quantidade?: number | null
          recebimento_confirmado?: boolean
          responsavel_recebimento?: string | null
          status?: Database["public"]["Enums"]["status_lote"]
          tipo?: Database["public"]["Enums"]["tipo_lote"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lotes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      marcas: {
        Row: {
          ativa: boolean
          cor: string | null
          created_at: string
          id: string
          linha: Database["public"]["Enums"]["linha_marca"]
          nome: string
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          cor?: string | null
          created_at?: string
          id?: string
          linha: Database["public"]["Enums"]["linha_marca"]
          nome: string
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          cor?: string | null
          created_at?: string
          id?: string
          linha?: Database["public"]["Enums"]["linha_marca"]
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      obras: {
        Row: {
          cidade: string | null
          cliente_id: string
          created_at: string
          data_fechamento: string | null
          finalizada_em: string | null
          id: string
          nome: string
          observacoes: string | null
          oportunidade_id: string | null
          problema_ativo: boolean
          problema_texto: string | null
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          cliente_id: string
          created_at?: string
          data_fechamento?: string | null
          finalizada_em?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          oportunidade_id?: string | null
          problema_ativo?: boolean
          problema_texto?: string | null
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          cliente_id?: string
          created_at?: string
          data_fechamento?: string | null
          finalizada_em?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          oportunidade_id?: string | null
          problema_ativo?: boolean
          problema_texto?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obras_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "oportunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      oportunidades: {
        Row: {
          cliente_id: string
          contato_id: string | null
          created_at: string
          descricao: string | null
          etapa: Database["public"]["Enums"]["etapa_comercial"]
          id: string
          marca_ids: string[]
          necessidade_prevista: string | null
          obra_id: string | null
          observacoes: string | null
          updated_at: string
        }
        Insert: {
          cliente_id: string
          contato_id?: string | null
          created_at?: string
          descricao?: string | null
          etapa?: Database["public"]["Enums"]["etapa_comercial"]
          id?: string
          marca_ids: string[]
          necessidade_prevista?: string | null
          obra_id?: string | null
          observacoes?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          contato_id?: string | null
          created_at?: string
          descricao?: string | null
          etapa?: Database["public"]["Enums"]["etapa_comercial"]
          id?: string
          marca_ids?: string[]
          necessidade_prevista?: string | null
          obra_id?: string | null
          observacoes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oportunidades_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oportunidades_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oportunidades_obra_fk"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      registros: {
        Row: {
          cliente_id: string | null
          contato_id: string | null
          created_at: string
          data: string
          direcao: Database["public"]["Enums"]["direcao_registro"]
          id: string
          lote_id: string | null
          obra_id: string | null
          oportunidade_id: string | null
          texto: string | null
          tipo: Database["public"]["Enums"]["tipo_registro"]
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          contato_id?: string | null
          created_at?: string
          data?: string
          direcao?: Database["public"]["Enums"]["direcao_registro"]
          id?: string
          lote_id?: string | null
          obra_id?: string | null
          oportunidade_id?: string | null
          texto?: string | null
          tipo: Database["public"]["Enums"]["tipo_registro"]
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          contato_id?: string | null
          created_at?: string
          data?: string
          direcao?: Database["public"]["Enums"]["direcao_registro"]
          id?: string
          lote_id?: string | null
          obra_id?: string | null
          oportunidade_id?: string | null
          texto?: string | null
          tipo?: Database["public"]["Enums"]["tipo_registro"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registros_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "oportunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios_autorizados: {
        Row: {
          created_at: string
          email: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      hoje_sp: { Args: never; Returns: string }
      is_authorized: { Args: never; Returns: boolean }
      normalizar_texto: { Args: { t: string }; Returns: string }
      so_digitos: { Args: { t: string }; Returns: string }
      whatsapp_normalizado: { Args: { t: string }; Returns: string }
    }
    Enums: {
      direcao_registro: "enviado" | "recebido" | "nenhuma"
      etapa_comercial:
        | "prospeccao"
        | "aguardando_demanda"
        | "demanda_prevista"
        | "orcamento"
        | "negociacao"
        | "fechado"
        | "perdido"
      linha_marca: "esquadrias" | "kit_porta" | "outra"
      origem_followup: "prospeccao" | "obra" | "automatico" | "manual"
      situacao_prado: "nao_verificado" | "livre" | "atendida_outro_rep"
      status_followup: "pendente" | "concluido" | "cancelado"
      status_lote:
        | "aguardando_cadastro"
        | "aguardando_medicao"
        | "medicao_agendada"
        | "medido"
        | "pcp"
        | "em_producao"
        | "produzido"
        | "entregue"
      tipo_lote:
        | "contramarco"
        | "apto_modelo"
        | "andar_tipo"
        | "area_comum"
        | "especiais"
        | "reposicao"
      tipo_registro:
        | "nota"
        | "ata"
        | "cronograma"
        | "medicao"
        | "ligacao"
        | "whatsapp"
        | "email"
        | "visita"
        | "problema"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      direcao_registro: ["enviado", "recebido", "nenhuma"],
      etapa_comercial: [
        "prospeccao",
        "aguardando_demanda",
        "demanda_prevista",
        "orcamento",
        "negociacao",
        "fechado",
        "perdido",
      ],
      linha_marca: ["esquadrias", "kit_porta", "outra"],
      origem_followup: ["prospeccao", "obra", "automatico", "manual"],
      situacao_prado: ["nao_verificado", "livre", "atendida_outro_rep"],
      status_followup: ["pendente", "concluido", "cancelado"],
      status_lote: [
        "aguardando_cadastro",
        "aguardando_medicao",
        "medicao_agendada",
        "medido",
        "pcp",
        "em_producao",
        "produzido",
        "entregue",
      ],
      tipo_lote: [
        "contramarco",
        "apto_modelo",
        "andar_tipo",
        "area_comum",
        "especiais",
        "reposicao",
      ],
      tipo_registro: [
        "nota",
        "ata",
        "cronograma",
        "medicao",
        "ligacao",
        "whatsapp",
        "email",
        "visita",
        "problema",
      ],
    },
  },
} as const
