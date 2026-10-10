-- Recalcular o prazo de todos os lotes não entregues quando os prazos mudarem
CREATE OR REPLACE FUNCTION public.recalcular_lotes() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  UPDATE public.lotes SET prazo_dias=(NEW.prazos->>tipo::text)::int WHERE entregue_em IS NULL;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.recalcular_lotes() FROM PUBLIC, anon, authenticated, service_role;

-- Alertas com cliente e contato; alertas de medição ignoram obras finalizadas
CREATE OR REPLACE VIEW public.v_alertas WITH (security_invoker=true) AS
SELECT 'cadastro_incompleto'::text tipo,'critico'::text nivel,o.id obra_id,o.oportunidade_id,l.id lote_id,'Cadastro incompleto do lote'::text mensagem,NULL::date data_ref,o.cliente_id,NULL::uuid contato_id FROM public.lotes l JOIN public.obras o ON o.id=l.obra_id WHERE NOT l.cadastro_completo AND o.finalizada_em IS NULL
UNION ALL SELECT 'medicao_sem_data','pendente',o.id,o.oportunidade_id,l.id,'Medição sem data',NULL::date,o.cliente_id,NULL::uuid FROM public.lotes l JOIN public.obras o ON o.id=l.obra_id WHERE l.status='aguardando_medicao' AND o.finalizada_em IS NULL
UNION ALL SELECT 'medicao_atrasada','critico',o.id,o.oportunidade_id,l.id,'Medição atrasada',l.previsao_medicao,o.cliente_id,NULL::uuid FROM public.lotes l JOIN public.obras o ON o.id=l.obra_id WHERE l.previsao_medicao<public.hoje_sp() AND l.medido_em IS NULL AND o.finalizada_em IS NULL
UNION ALL SELECT 'entrega_sem_recebimento','pendente',o.id,o.oportunidade_id,l.id,'Entrega sem confirmação de recebimento',coalesce(l.data_confirmada,l.previsao_entrega),o.cliente_id,NULL::uuid FROM public.lotes l JOIN public.obras o ON o.id=l.obra_id CROSS JOIN public.configuracoes c WHERE c.id=1 AND coalesce(l.data_confirmada,l.previsao_entrega) BETWEEN public.hoje_sp() AND public.hoje_sp()+c.alerta_entrega_dias AND NOT l.recebimento_confirmado AND l.entregue_em IS NULL
UNION ALL SELECT 'entrega_atrasada','critico',o.id,o.oportunidade_id,l.id,'Entrega atrasada',coalesce(l.data_confirmada,l.previsao_entrega),o.cliente_id,NULL::uuid FROM public.lotes l JOIN public.obras o ON o.id=l.obra_id WHERE coalesce(l.data_confirmada,l.previsao_entrega)<public.hoje_sp() AND l.entregue_em IS NULL
UNION ALL SELECT 'problema_obra','critico',o.id,o.oportunidade_id,NULL::uuid,o.problema_texto,NULL::date,o.cliente_id,NULL::uuid FROM public.obras o WHERE o.problema_ativo
UNION ALL SELECT 'followup_vencido','pendente',f.obra_id,f.oportunidade_id,f.lote_id,f.motivo,f.data,f.cliente_id,f.contato_id FROM public.followups f WHERE f.status='pendente' AND f.data<public.hoje_sp();
REVOKE ALL ON public.v_alertas FROM PUBLIC, anon;
GRANT SELECT ON public.v_alertas TO authenticated, service_role;
