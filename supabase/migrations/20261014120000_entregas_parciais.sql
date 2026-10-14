-- Entregas parciais por lote (2, 3, 4 ou mais entregas)
CREATE TABLE IF NOT EXISTS public.entregas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES public.lotes(id) ON DELETE CASCADE,
  numero int NOT NULL CHECK (numero >= 1),
  quantidade int CHECK (quantidade IS NULL OR quantidade >= 0),
  previsao date,
  data_confirmada date,
  entregue_em date,
  recebimento_confirmado boolean NOT NULL DEFAULT false,
  responsavel_recebimento text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lote_id, numero)
);
CREATE INDEX IF NOT EXISTS entregas_lote ON public.entregas(lote_id);

ALTER TABLE public.entregas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS entregas_acesso ON public.entregas;
CREATE POLICY entregas_acesso ON public.entregas FOR ALL USING (public.is_authorized()) WITH CHECK (public.is_authorized());
REVOKE ALL ON public.entregas FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entregas TO authenticated, service_role;

DROP TRIGGER IF EXISTS entregas_timestamp ON public.entregas;
CREATE TRIGGER entregas_timestamp BEFORE UPDATE ON public.entregas FOR EACH ROW EXECUTE FUNCTION public.atualizar_timestamp();

-- Regra: entrega só com o lote medido
CREATE OR REPLACE FUNCTION public.validar_entrega() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.entregue_em IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.lotes WHERE id=NEW.lote_id AND medido_em IS NOT NULL) THEN
    RAISE EXCEPTION 'Registre a medição do lote antes da entrega.';
  END IF;
  NEW.responsavel_recebimento=nullif(trim(NEW.responsavel_recebimento),'');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS entregas_validar ON public.entregas;
CREATE TRIGGER entregas_validar BEFORE INSERT OR UPDATE ON public.entregas FOR EACH ROW EXECUTE FUNCTION public.validar_entrega();

-- O lote passa a refletir a próxima entrega pendente.
-- Lote só fica "entregue" quando todas as entregas foram feitas.
CREATE OR REPLACE FUNCTION public.sincronizar_lote_entregas() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE lid uuid; total int; p public.entregas; ult public.entregas;
BEGIN
  lid=coalesce(NEW.lote_id,OLD.lote_id);
  IF NOT EXISTS(SELECT 1 FROM public.lotes WHERE id=lid) THEN RETURN NULL; END IF;
  SELECT count(*) INTO total FROM public.entregas WHERE lote_id=lid;
  IF total=0 THEN
    UPDATE public.lotes SET entregue_em=NULL,data_confirmada=NULL,recebimento_confirmado=false,responsavel_recebimento=NULL WHERE id=lid;
  ELSE
    SELECT * INTO p FROM public.entregas WHERE lote_id=lid AND entregue_em IS NULL
      ORDER BY coalesce(data_confirmada,previsao) NULLS LAST, numero LIMIT 1;
    IF FOUND THEN
      UPDATE public.lotes SET entregue_em=NULL,data_confirmada=coalesce(p.data_confirmada,p.previsao),
        recebimento_confirmado=p.recebimento_confirmado,responsavel_recebimento=p.responsavel_recebimento WHERE id=lid;
    ELSE
      SELECT * INTO ult FROM public.entregas WHERE lote_id=lid ORDER BY entregue_em DESC, numero DESC LIMIT 1;
      UPDATE public.lotes SET entregue_em=ult.entregue_em,data_confirmada=ult.data_confirmada,
        recebimento_confirmado=true,responsavel_recebimento=ult.responsavel_recebimento WHERE id=lid;
    END IF;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS entregas_sincronizar ON public.entregas;
CREATE TRIGGER entregas_sincronizar AFTER INSERT OR UPDATE OR DELETE ON public.entregas FOR EACH ROW EXECUTE FUNCTION public.sincronizar_lote_entregas();

REVOKE ALL ON FUNCTION public.validar_entrega(), public.sincronizar_lote_entregas() FROM PUBLIC, anon, authenticated, service_role;
