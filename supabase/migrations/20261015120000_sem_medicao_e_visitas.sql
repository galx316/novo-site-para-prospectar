-- Lote sem medição (apto modelo, reposição) e categoria do follow-up (visitas e serviços)
ALTER TABLE public.lotes ADD COLUMN IF NOT EXISTS sem_medicao boolean NOT NULL DEFAULT false;

ALTER TABLE public.followups ADD COLUMN IF NOT EXISTS categoria text;
ALTER TABLE public.followups DROP CONSTRAINT IF EXISTS followups_categoria_valida;
ALTER TABLE public.followups ADD CONSTRAINT followups_categoria_valida
  CHECK (categoria IS NULL OR categoria IN ('visita_tecnica','regulagem','treinamento','outro'));

-- Status e prazo do lote: lote sem medição pula as etapas de medição
CREATE OR REPLACE FUNCTION public.calcular_lote() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE c public.configuracoes; fim date;
BEGIN
  SELECT * INTO STRICT c FROM public.configuracoes WHERE id=1;
  IF NEW.prazo_dias IS NULL THEN NEW.prazo_dias=(c.prazos->>NEW.tipo::text)::int; END IF;
  IF NEW.entregue_em IS NOT NULL THEN NEW.status='entregue';
  ELSIF NEW.status NOT IN ('pcp','em_producao','produzido') THEN
    IF NOT NEW.cadastro_completo THEN NEW.status='aguardando_cadastro';
    ELSIF NEW.sem_medicao THEN NEW.status='pcp';
    ELSIF NEW.medido_em IS NOT NULL THEN
      IF NEW.status IN ('aguardando_cadastro','aguardando_medicao','medicao_agendada','entregue') THEN NEW.status='medido'; END IF;
    ELSIF NEW.previsao_medicao IS NOT NULL THEN NEW.status='medicao_agendada';
    ELSE NEW.status='aguardando_medicao';
    END IF;
  END IF;
  NEW.acrescimo_ferias_dias=0; NEW.ferias_pendente=false;
  IF NEW.medido_em IS NOT NULL THEN
    fim=NEW.medido_em+NEW.prazo_dias;
    IF c.ferias_inicio IS NULL OR c.ferias_fim IS NULL THEN NEW.ferias_pendente=true;
    ELSIF NEW.medido_em<=c.ferias_fim AND fim>=c.ferias_inicio THEN NEW.acrescimo_ferias_dias=c.acrescimo_ferias_dias; END IF;
    NEW.previsao_entrega=fim+NEW.acrescimo_ferias_dias;
  ELSE NEW.previsao_entrega=NULL;
  END IF;
  RETURN NEW;
END $$;

-- Entrega: exige medição, exceto em lote sem medição
CREATE OR REPLACE FUNCTION public.validar_entrega() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.entregue_em IS NOT NULL AND NOT EXISTS(
       SELECT 1 FROM public.lotes WHERE id=NEW.lote_id AND (medido_em IS NOT NULL OR sem_medicao)) THEN
    RAISE EXCEPTION 'Registre a medição do lote antes da entrega.';
  END IF;
  NEW.responsavel_recebimento=nullif(trim(NEW.responsavel_recebimento),'');
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.calcular_lote(), public.validar_entrega() FROM PUBLIC, anon, authenticated, service_role;

-- Alertas: "cadastro incompleto" não vale para lote já entregue
CREATE OR REPLACE VIEW public.v_alertas WITH (security_invoker=true) AS
SELECT 'cadastro_incompleto'::text tipo,'critico'::text nivel,o.id obra_id,o.oportunidade_id,l.id lote_id,'Cadastro incompleto do lote'::text mensagem,NULL::date data_ref,o.cliente_id,NULL::uuid contato_id FROM public.lotes l JOIN public.obras o ON o.id=l.obra_id WHERE NOT l.cadastro_completo AND l.entregue_em IS NULL AND o.finalizada_em IS NULL
UNION ALL SELECT 'medicao_sem_data','pendente',o.id,o.oportunidade_id,l.id,'Medição sem data',NULL::date,o.cliente_id,NULL::uuid FROM public.lotes l JOIN public.obras o ON o.id=l.obra_id WHERE l.status='aguardando_medicao' AND o.finalizada_em IS NULL
UNION ALL SELECT 'medicao_atrasada','critico',o.id,o.oportunidade_id,l.id,'Medição atrasada',l.previsao_medicao,o.cliente_id,NULL::uuid FROM public.lotes l JOIN public.obras o ON o.id=l.obra_id WHERE l.previsao_medicao<public.hoje_sp() AND l.medido_em IS NULL AND NOT l.sem_medicao AND o.finalizada_em IS NULL
UNION ALL SELECT 'entrega_sem_recebimento','pendente',o.id,o.oportunidade_id,l.id,'Entrega sem confirmação de recebimento',coalesce(l.data_confirmada,l.previsao_entrega),o.cliente_id,NULL::uuid FROM public.lotes l JOIN public.obras o ON o.id=l.obra_id CROSS JOIN public.configuracoes c WHERE c.id=1 AND coalesce(l.data_confirmada,l.previsao_entrega) BETWEEN public.hoje_sp() AND public.hoje_sp()+c.alerta_entrega_dias AND NOT l.recebimento_confirmado AND l.entregue_em IS NULL
UNION ALL SELECT 'entrega_atrasada','critico',o.id,o.oportunidade_id,l.id,'Entrega atrasada',coalesce(l.data_confirmada,l.previsao_entrega),o.cliente_id,NULL::uuid FROM public.lotes l JOIN public.obras o ON o.id=l.obra_id WHERE coalesce(l.data_confirmada,l.previsao_entrega)<public.hoje_sp() AND l.entregue_em IS NULL
UNION ALL SELECT 'problema_obra','critico',o.id,o.oportunidade_id,NULL::uuid,o.problema_texto,NULL::date,o.cliente_id,NULL::uuid FROM public.obras o WHERE o.problema_ativo
UNION ALL SELECT 'followup_vencido','pendente',f.obra_id,f.oportunidade_id,f.lote_id,f.motivo,f.data,f.cliente_id,f.contato_id FROM public.followups f WHERE f.status='pendente' AND f.data<public.hoje_sp();
REVOKE ALL ON public.v_alertas FROM PUBLIC, anon;
GRANT SELECT ON public.v_alertas TO authenticated, service_role;
