DO $$ DECLARE c uuid; o uuid; l public.lotes; n int; BEGIN
IF public.normalizar_texto('M.R.V.')<>'mrv' OR public.normalizar_texto('  Construtora   SÃO José ')<>'construtora sao jose' OR public.so_digitos('abc') IS NOT NULL OR public.whatsapp_normalizado('(11) 99999-8888')<>'5511999998888' THEN RAISE EXCEPTION 'Falha na normalização'; END IF;
IF (SELECT count(*) FROM public.marcas)<>4 OR NOT EXISTS(SELECT 1 FROM public.configuracoes WHERE id=1) THEN RAISE EXCEPTION 'Falha nos seeds'; END IF;
BEGIN
INSERT INTO public.clientes(nome) VALUES('__GAL validação temporária__') RETURNING id INTO c;
INSERT INTO public.obras(cliente_id,nome) VALUES(c,'Validação temporária') RETURNING id INTO o;
SELECT count(*) INTO n FROM public.checklist_itens WHERE obra_id=o; IF n<>9 THEN RAISE EXCEPTION 'Checklist incorreto'; END IF;
SELECT count(*) INTO n FROM public.followups WHERE obra_id=o; IF n<>3 THEN RAISE EXCEPTION 'Tarefas iniciais incorretas'; END IF;
INSERT INTO public.lotes(obra_id,tipo,cadastro_completo,medido_em) VALUES(o,'contramarco',true,'2026-12-01') RETURNING * INTO l;
IF l.status<>'medido' OR l.prazo_dias<>30 OR l.previsao_entrega<>'2026-12-31' OR NOT l.ferias_pendente THEN RAISE EXCEPTION 'Cálculo inicial incorreto'; END IF;
UPDATE public.configuracoes SET ferias_inicio='2026-12-20',ferias_fim='2027-01-10' WHERE id=1;
SELECT * INTO l FROM public.lotes WHERE id=l.id;
IF l.previsao_entrega<>'2027-01-25' OR l.acrescimo_ferias_dias<>25 OR l.ferias_pendente THEN RAISE EXCEPTION 'Cálculo férias incorreto'; END IF;
UPDATE public.lotes SET status='pcp' WHERE id=l.id; UPDATE public.configuracoes SET prazos=jsonb_set(prazos,'{contramarco}','31') WHERE id=1;
SELECT * INTO l FROM public.lotes WHERE id=l.id; IF l.status<>'pcp' OR l.prazo_dias<>31 THEN RAISE EXCEPTION 'Recalculo ou status manual incorreto'; END IF;
UPDATE public.lotes SET entregue_em='2027-01-26' WHERE id=l.id; SELECT * INTO l FROM public.lotes WHERE id=l.id; IF l.status<>'entregue' THEN RAISE EXCEPTION 'Status de entrega incorreto'; END IF;
UPDATE public.obras SET finalizada_em='2027-01-26' WHERE id=o;
IF NOT EXISTS(SELECT 1 FROM public.followups WHERE obra_id=o AND data='2027-03-07' AND motivo='Revisão de 40 dias: regulagem e fotos da limpeza') THEN RAISE EXCEPTION 'Revisão incorreta'; END IF;
RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='Rollback dos dados temporários após validação';
EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL; END;
END $$;