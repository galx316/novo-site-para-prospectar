-- Situação comercial por marca (PRADO continua em clientes.situacao_prado)
CREATE TABLE IF NOT EXISTS public.situacao_marca (
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  marca_id uuid NOT NULL REFERENCES public.marcas(id),
  situacao public.situacao_prado NOT NULL DEFAULT 'nao_verificado',
  representante text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cliente_id, marca_id)
);
ALTER TABLE public.situacao_marca ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS situacao_marca_acesso ON public.situacao_marca;
CREATE POLICY situacao_marca_acesso ON public.situacao_marca FOR ALL USING (public.is_authorized()) WITH CHECK (public.is_authorized());
REVOKE ALL ON public.situacao_marca FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.situacao_marca TO authenticated, service_role;
DROP TRIGGER IF EXISTS situacao_marca_timestamp ON public.situacao_marca;
CREATE TRIGGER situacao_marca_timestamp BEFORE UPDATE ON public.situacao_marca FOR EACH ROW EXECUTE FUNCTION public.atualizar_timestamp();

-- PRADO não entra nesta tabela (ela fica em clientes.situacao_prado)
CREATE OR REPLACE FUNCTION public.validar_situacao_marca() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.marcas WHERE id=NEW.marca_id AND nome='PRADO') THEN
    RAISE EXCEPTION 'A situação da PRADO fica na construtora (situacao_prado).';
  END IF;
  NEW.representante=nullif(trim(NEW.representante),'');
  IF NEW.situacao<>'atendida_outro_rep' THEN NEW.representante=NULL; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS situacao_marca_validar ON public.situacao_marca;
CREATE TRIGGER situacao_marca_validar BEFORE INSERT OR UPDATE ON public.situacao_marca FOR EACH ROW EXECUTE FUNCTION public.validar_situacao_marca();
REVOKE ALL ON FUNCTION public.validar_situacao_marca() FROM PUBLIC, anon, authenticated, service_role;

-- Mesclar construtoras também leva a situação por marca
CREATE OR REPLACE FUNCTION public.mesclar_clientes(p_manter uuid, p_remover uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE nome_removido text; BEGIN IF NOT public.is_authorized() THEN RAISE EXCEPTION 'Não autorizado' USING ERRCODE='42501'; END IF; IF p_manter IS NULL OR p_remover IS NULL OR p_manter=p_remover THEN RAISE EXCEPTION 'Informe dois clientes diferentes'; END IF; PERFORM id FROM public.clientes WHERE id IN(p_manter,p_remover) ORDER BY id FOR UPDATE; IF NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=p_manter) THEN RAISE EXCEPTION 'Cliente a manter não encontrado'; END IF; SELECT nome INTO STRICT nome_removido FROM public.clientes WHERE id=p_remover; UPDATE public.contatos SET cliente_id=p_manter WHERE cliente_id=p_remover; UPDATE public.oportunidades SET cliente_id=p_manter WHERE cliente_id=p_remover; UPDATE public.obras SET cliente_id=p_manter WHERE cliente_id=p_remover; UPDATE public.registros SET cliente_id=p_manter WHERE cliente_id=p_remover; UPDATE public.followups SET cliente_id=p_manter WHERE cliente_id=p_remover; INSERT INTO public.situacao_marca(cliente_id,marca_id,situacao,representante) SELECT p_manter,marca_id,situacao,representante FROM public.situacao_marca WHERE cliente_id=p_remover ON CONFLICT DO NOTHING; INSERT INTO public.registros(cliente_id,tipo,texto) VALUES(p_manter,'nota','Mesclado com '||nome_removido); DELETE FROM public.clientes WHERE id=p_remover; END $function$;
