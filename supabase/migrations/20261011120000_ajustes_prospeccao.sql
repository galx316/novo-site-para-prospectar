-- 1. Situação do cliente: "Já é cliente"
ALTER TYPE public.situacao_prado ADD VALUE IF NOT EXISTS 'ja_cliente' AFTER 'livre';

-- 2. Tipo de registro "outro" (atividade personalizada)
ALTER TYPE public.tipo_registro ADD VALUE IF NOT EXISTS 'outro';

-- 3. Telefone fixo no contato (só dígitos, não único)
ALTER TABLE public.contatos ADD COLUMN IF NOT EXISTS telefone text;

CREATE OR REPLACE FUNCTION public.normalizar_contato() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  NEW.whatsapp=public.whatsapp_normalizado(NEW.whatsapp);
  NEW.telefone=public.so_digitos(NEW.telefone);
  NEW.email=nullif(lower(trim(NEW.email)),'');
  RETURN NEW;
END $$;

-- 4. Chave de busca: nome sem palavras genéricas e sem espaços
CREATE OR REPLACE FUNCTION public.chave_cliente(t text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT coalesce(
    nullif(array_to_string(array(
      SELECT w FROM unnest(string_to_array(public.normalizar_texto(t),' ')) WITH ORDINALITY AS x(w,n)
      WHERE w<>'' AND w NOT IN ('construtora','construtoras','construcoes','construcao','engenharia','incorporadora','incorporadoras','incorporacoes','incorporacao','empreendimentos','empreendimento','imobiliaria','imoveis','participacoes','ltda','sa','eireli','me','epp','grupo','cia','e','de','da','do','das','dos')
      ORDER BY n), ''), ''),
    replace(public.normalizar_texto(t),' ',''));
$$;

ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS nome_chave text;

CREATE OR REPLACE FUNCTION public.normalizar_cliente() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  NEW.nome_normalizado=public.normalizar_texto(NEW.nome);
  IF NEW.nome_normalizado='' THEN RAISE EXCEPTION 'Nome de cliente inválido'; END IF;
  NEW.nome_chave=public.chave_cliente(NEW.nome);
  NEW.cnpj=public.so_digitos(NEW.cnpj);
  RETURN NEW;
END $$;

UPDATE public.clientes SET nome_chave=public.chave_cliente(nome);
CREATE INDEX IF NOT EXISTS clientes_chave_busca ON public.clientes USING gin(nome_chave extensions.gin_trgm_ops);

-- 5. Busca de parecidos: compara a chave e palavra por palavra
CREATE OR REPLACE FUNCTION public.buscar_clientes(p_texto text, p_limite int DEFAULT 10)
RETURNS TABLE(id uuid, nome text, situacao_prado public.situacao_prado, representante_prado text, similaridade real)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t text; k text;
BEGIN
  IF NOT public.is_authorized() THEN RAISE EXCEPTION 'Não autorizado' USING ERRCODE='42501'; END IF;
  t=public.normalizar_texto(p_texto);
  k=public.chave_cliente(p_texto);
  RETURN QUERY
  SELECT c.id, c.nome, c.situacao_prado, c.representante_prado,
         greatest(
           extensions.similarity(c.nome_normalizado,t),
           extensions.similarity(c.nome_chave,k),
           extensions.word_similarity(k,c.nome_chave),
           CASE WHEN position(t in c.nome_normalizado)>0 OR position(k in c.nome_chave)>0
                  OR (length(c.nome_chave)>=4 AND position(c.nome_chave in k)>0) THEN 1 ELSE 0 END
         )::real AS s
  FROM public.clientes c
  WHERE t<>'' AND (
        position(t in c.nome_normalizado)>0
     OR position(k in c.nome_chave)>0
     OR (length(c.nome_chave)>=4 AND position(c.nome_chave in k)>0)
     OR extensions.similarity(c.nome_chave,k)>=0.3
     OR extensions.word_similarity(k,c.nome_chave)>=0.5
     OR extensions.similarity(c.nome_normalizado,t)>=0.3)
  ORDER BY s DESC, c.nome
  LIMIT greatest(1,least(coalesce(p_limite,10),100));
END $$;

-- 6. Marcas: PRADO e Imab fixas; Scalla e Rohden só como personalizadas
UPDATE public.marcas SET ativa=false WHERE nome IN ('Scalla','Rohden');
CREATE UNIQUE INDEX IF NOT EXISTS marcas_nome_normalizado_unico ON public.marcas (public.normalizar_texto(nome));

CREATE OR REPLACE FUNCTION public.obter_ou_criar_marca(p_nome text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.marcas; n text;
BEGIN
  IF NOT public.is_authorized() THEN RAISE EXCEPTION 'Não autorizado' USING ERRCODE='42501'; END IF;
  n=trim(regexp_replace(coalesce(p_nome,''),'\s+',' ','g'));
  IF public.normalizar_texto(n)='' THEN RAISE EXCEPTION 'Informe o nome da marca'; END IF;
  SELECT * INTO m FROM public.marcas WHERE public.normalizar_texto(nome)=public.normalizar_texto(n);
  IF FOUND THEN
    IF NOT m.ativa THEN UPDATE public.marcas SET ativa=true WHERE id=m.id; END IF;
    RETURN m.id;
  END IF;
  INSERT INTO public.marcas(nome,linha) VALUES(n,'outra') RETURNING * INTO m;
  RETURN m.id;
END $$;

-- 7. Registrar atividade (ligação, visita, e-mail, nota ou personalizada)
CREATE OR REPLACE FUNCTION public.registrar_atividade(
  p_tipo public.tipo_registro,
  p_texto text,
  p_cliente_id uuid DEFAULT NULL,
  p_contato_id uuid DEFAULT NULL,
  p_oportunidade_id uuid DEFAULT NULL,
  p_data_proxima date DEFAULT NULL,
  p_motivo text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.contatos; cli uuid; fid uuid; mot text;
BEGIN
  IF NOT public.is_authorized() THEN RAISE EXCEPTION 'Não autorizado' USING ERRCODE='42501'; END IF;
  IF nullif(trim(p_texto),'') IS NULL THEN RAISE EXCEPTION 'Descreva a atividade'; END IF;
  cli=p_cliente_id;
  IF p_contato_id IS NOT NULL THEN
    SELECT * INTO STRICT c FROM public.contatos WHERE id=p_contato_id;
    cli=coalesce(cli,c.cliente_id);
  END IF;
  IF cli IS NULL AND p_contato_id IS NULL THEN RAISE EXCEPTION 'Informe a construtora ou o contato'; END IF;
  IF p_oportunidade_id IS NOT NULL AND NOT EXISTS(
       SELECT 1 FROM public.oportunidades o WHERE o.id=p_oportunidade_id AND o.cliente_id=cli
       AND (p_contato_id IS NULL OR o.contato_id IS NULL OR o.contato_id=p_contato_id)) THEN
    RAISE EXCEPTION 'Oportunidade incompatível com a construtora ou o contato';
  END IF;

  INSERT INTO public.registros(cliente_id,contato_id,oportunidade_id,tipo,direcao,texto)
  VALUES(cli,p_contato_id,p_oportunidade_id,p_tipo,'nenhuma',trim(p_texto));

  IF p_data_proxima IS NOT NULL THEN
    mot=coalesce(nullif(trim(p_motivo),''),'Próximo passo');
    IF p_contato_id IS NOT NULL THEN
      SELECT f.id INTO fid FROM public.followups f
       WHERE f.contato_id=p_contato_id AND f.origem='prospeccao' AND f.status='pendente' LIMIT 1;
    END IF;
    IF fid IS NOT NULL THEN
      UPDATE public.followups SET data=p_data_proxima, motivo=mot WHERE id=fid;
    ELSE
      INSERT INTO public.followups(cliente_id,contato_id,oportunidade_id,data,motivo,origem)
      VALUES(cli,p_contato_id,p_oportunidade_id,p_data_proxima,mot,'manual');
    END IF;
  END IF;
END $$;

-- Permissões
REVOKE ALL ON FUNCTION public.chave_cliente(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chave_cliente(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.normalizar_contato(), public.normalizar_cliente() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.buscar_clientes(text,int), public.obter_ou_criar_marca(text),
  public.registrar_atividade(public.tipo_registro,text,uuid,uuid,uuid,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buscar_clientes(text,int), public.obter_ou_criar_marca(text),
  public.registrar_atividade(public.tipo_registro,text,uuid,uuid,uuid,date,text) TO authenticated, service_role;
