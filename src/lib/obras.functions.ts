import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Database } from '@/integrations/supabase/types';
import { formatarData, obterHojeSP } from '@/lib/date-utils';

type TipoLote = Database['public']['Enums']['tipo_lote'];
type StatusLote = Database['public']['Enums']['status_lote'];
type TipoRegistro = Database['public']['Enums']['tipo_registro'];

export const TIPOS_LOTE_LABELS: Record<TipoLote, string> = {
  contramarco: 'Contramarco',
  apto_modelo: 'Apto modelo',
  andar_tipo: 'Andar tipo',
  area_comum: 'Área comum',
  especiais: 'Especiais',
  reposicao: 'Reposição',
};

export const STATUS_LOTE_LABELS: Record<StatusLote, string> = {
  aguardando_cadastro: 'Aguardando cadastro',
  aguardando_medicao: 'Aguardando medição',
  medicao_agendada: 'Medição agendada',
  medido: 'Medido',
  pcp: 'PCP',
  em_producao: 'Em produção',
  produzido: 'Produzido',
  entregue: 'Entregue',
};

async function assertAuthorized(supabase: any) {
  const { data: authorized, error } = await supabase.rpc('is_authorized');
  if (error) throw new Error(error.message);
  if (!authorized) throw new Error('Seu e-mail não está autorizado no sistema.');
}

/**
 * 1. Listar todas as obras com resumo operacional de lotes e próximas entregas.
 */
export const listarObras = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    const { data: obrasData, error: errObras } = await supabase
      .from('obras')
      .select(`
        id,
        nome,
        cidade,
        data_fechamento,
        finalizada_em,
        problema_ativo,
        problema_texto,
        cliente_id,
        clientes (
          id,
          nome
        ),
        lotes (
          id,
          status,
          previsao_entrega,
          data_confirmada,
          entregue_em
        )
      `);

    if (errObras) throw new Error(errObras.message);

    const obras = (obrasData || []).map((obra: any) => {
      const lotes = obra.lotes || [];
      const totalLotes = lotes.length;
      const lotesEntregues = lotes.filter(
        (l: any) => l.status === 'entregue' || l.entregue_em !== null
      ).length;

      // Menor previsão de entrega entre os lotes não entregues: coalesce(data_confirmada, previsao_entrega)
      const previsoesNaoEntregues = lotes
        .filter((l: any) => l.status !== 'entregue' && l.entregue_em === null)
        .map((l: any) => l.data_confirmada || l.previsao_entrega)
        .filter(Boolean)
        .sort();

      const proximaEntrega = previsoesNaoEntregues[0] || null;

      return {
        id: obra.id,
        nome: obra.nome,
        cidade: obra.cidade,
        clienteId: obra.cliente_id,
        clienteNome: obra.clientes?.nome || '—',
        data_fechamento: obra.data_fechamento,
        finalizada_em: obra.finalizada_em,
        problema_ativo: obra.problema_ativo,
        problema_texto: obra.problema_texto,
        totalLotes,
        lotesEntregues,
        proximaEntrega,
      };
    });

    // Ordem: em andamento primeiro, depois por nome
    obras.sort((a: any, b: any) => {
      const aFinalizada = a.finalizada_em ? 1 : 0;
      const bFinalizada = b.finalizada_em ? 1 : 0;
      if (aFinalizada !== bFinalizada) {
        return aFinalizada - bFinalizada;
      }
      return (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' });
    });

    return obras;
  });

/**
 * 2. Obter dados completos de uma obra.
 */
export const obterObra = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .validator((data: { obraId: string }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    if (!data.obraId) throw new Error('ID da obra não informado.');

    const { data: obra, error: obraErr } = await supabase
      .from('obras')
      .select('*')
      .eq('id', data.obraId)
      .single();

    if (obraErr || !obra) throw new Error(obraErr?.message || 'Obra não encontrada.');

    const [clienteRes, opRes, lotesRes, checklistRes, registrosRes, arquivosRes, followupsRes] =
      await Promise.all([
        supabase.from('clientes').select('id, nome').eq('id', obra.cliente_id).single(),
        obra.oportunidade_id
          ? supabase
              .from('oportunidades')
              .select('id, descricao')
              .eq('id', obra.oportunidade_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from('lotes')
          .select('*')
          .eq('obra_id', data.obraId)
          .order('created_at', { ascending: true }),
        supabase
          .from('checklist_itens')
          .select('*')
          .eq('obra_id', data.obraId)
          .order('ordem', { ascending: true }),
        supabase
          .from('registros')
          .select('*')
          .eq('obra_id', data.obraId)
          .order('data', { ascending: false }),
        supabase
          .from('arquivos')
          .select('*')
          .eq('obra_id', data.obraId)
          .order('created_at', { ascending: false }),
        supabase
          .from('followups')
          .select('*')
          .eq('obra_id', data.obraId)
          .eq('status', 'pendente')
          .order('data', { ascending: true }),
      ]);

    if (clienteRes.error) throw new Error(clienteRes.error.message);
    if (opRes.error) throw new Error(opRes.error.message);
    if (lotesRes.error) throw new Error(lotesRes.error.message);
    if (checklistRes.error) throw new Error(checklistRes.error.message);
    if (registrosRes.error) throw new Error(registrosRes.error.message);
    if (arquivosRes.error) throw new Error(arquivosRes.error.message);
    if (followupsRes.error) throw new Error(followupsRes.error.message);

    return {
      obra,
      cliente: clienteRes.data,
      oportunidade: opRes.data,
      lotes: lotesRes.data || [],
      checklist: checklistRes.data || [],
      registros: registrosRes.data || [],
      arquivos: arquivosRes.data || [],
      followups: followupsRes.data || [],
    };
  });

/**
 * 3. Iniciar gestão de obra através da RPC.
 */
export const iniciarGestaoObra = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: {
    oportunidadeId: string;
    nome: string;
    cidade?: string | null | undefined;
    dataFechamento?: string | null | undefined;
    jaEmAndamento?: boolean | undefined;
  }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    const nomeLimpo = data.nome?.trim();
    if (!nomeLimpo) throw new Error('Informe o nome da obra.');
    if (!data.oportunidadeId) throw new Error('ID da oportunidade não informado.');

    const { data: obraId, error } = await supabase.rpc('iniciar_gestao_obra', {
      p_oportunidade_id: data.oportunidadeId,
      p_nome: nomeLimpo,
    });

    if (error) throw new Error(error.message);

    // Se vier cidade ou dataFechamento, update em obras
    const updatesObra: any = {};
    if (data.cidade !== undefined) updatesObra.cidade = data.cidade?.trim() || null;
    if (data.dataFechamento !== undefined && data.dataFechamento) {
      updatesObra.data_fechamento = data.dataFechamento;
    }

    if (Object.keys(updatesObra).length > 0) {
      const { error: updErr } = await supabase
        .from('obras')
        .update(updatesObra)
        .eq('id', obraId);
      if (updErr) throw new Error(updErr.message);
    }

    // Se jaEmAndamento = true: cancelar as 3 tarefas iniciais
    if (data.jaEmAndamento) {
      const { error: cancelErr } = await supabase
        .from('followups')
        .update({ status: 'cancelado' })
        .eq('obra_id', obraId)
        .eq('status', 'pendente')
        .eq('origem', 'automatico')
        .in('motivo', ['Solicitar laudos e ARTs', 'Cadastrar pedido completo', 'Agendar medição']);
      if (cancelErr) throw new Error(cancelErr.message);
    }

    return { obraId: obraId as string };
  });

/**
 * 3.1 Cadastrar obra já fechada (cria oportunidade PRADO em negociacao e inicia gestão).
 */
export const cadastrarObraFechada = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: {
    clienteId: string;
    contatoId?: string | null | undefined;
    nome: string;
    cidade?: string | null | undefined;
    dataFechamento?: string | null | undefined;
    jaEmAndamento?: boolean | undefined;
  }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    const nomeLimpo = data.nome?.trim();
    if (!nomeLimpo) throw new Error('Informe o nome da obra.');
    if (!data.clienteId) throw new Error('ID da construtora não informado.');

    // a) buscar id da marca PRADO
    const { data: marcaPrado, error: marcaErr } = await supabase
      .from('marcas')
      .select('id')
      .eq('nome', 'PRADO')
      .single();

    if (marcaErr || !marcaPrado) throw new Error('Marca PRADO não encontrada.');

    // b) insert em oportunidades: cliente_id, contato_id, marca_ids [PRADO], descricao = nome da obra, etapa 'negociacao'
    const { data: novaOp, error: opErr } = await supabase
      .from('oportunidades')
      .insert({
        cliente_id: data.clienteId,
        contato_id: data.contatoId || null,
        marca_ids: [marcaPrado.id],
        descricao: nomeLimpo,
        etapa: 'negociacao',
      })
      .select()
      .single();

    if (opErr || !novaOp) throw new Error(opErr?.message || 'Erro ao criar oportunidade.');

    // c) chamar RPC iniciar_gestao_obra
    let obraId: string;
    try {
      const { data: resObraId, error: rpcErr } = await supabase.rpc('iniciar_gestao_obra', {
        p_oportunidade_id: novaOp.id,
        p_nome: nomeLimpo,
      });

      if (rpcErr) throw new Error(rpcErr.message);
      obraId = resObraId as string;
    } catch (rpcFail: any) {
      // d) se a RPC falhar, apagar a oportunidade criada
      await supabase.from('oportunidades').delete().eq('id', novaOp.id);
      throw new Error(rpcFail.message || 'Erro ao iniciar gestão da obra.');
    }

    const updatesObra: any = {};
    if (data.cidade !== undefined) updatesObra.cidade = data.cidade?.trim() || null;
    if (data.dataFechamento !== undefined && data.dataFechamento) {
      updatesObra.data_fechamento = data.dataFechamento;
    }

    if (Object.keys(updatesObra).length > 0) {
      const { error: updErr } = await supabase
        .from('obras')
        .update(updatesObra)
        .eq('id', obraId);
      if (updErr) throw new Error(updErr.message);
    }

    if (data.jaEmAndamento) {
      const { error: cancelErr } = await supabase
        .from('followups')
        .update({ status: 'cancelado' })
        .eq('obra_id', obraId)
        .eq('status', 'pendente')
        .eq('origem', 'automatico')
        .in('motivo', ['Solicitar laudos e ARTs', 'Cadastrar pedido completo', 'Agendar medição']);
      if (cancelErr) throw new Error(cancelErr.message);
    }

    return { obraId };
  });

/**
 * 3.2 Editar dados da obra (nome, cidade, data_fechamento, observacoes).
 */
export const editarObra = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: {
    obraId: string;
    nome: string;
    cidade?: string | null | undefined;
    dataFechamento?: string | null | undefined;
    observacoes?: string | null | undefined;
  }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    if (!data.obraId) throw new Error('ID da obra não informado.');
    const nomeLimpo = data.nome?.trim();
    if (!nomeLimpo) throw new Error('Informe o nome da obra.');

    const { data: obraAtualizada, error: updErr } = await supabase
      .from('obras')
      .update({
        nome: nomeLimpo,
        cidade: data.cidade?.trim() || null,
        data_fechamento: data.dataFechamento || null,
        observacoes: data.observacoes?.trim() || null,
      })
      .eq('id', data.obraId)
      .select()
      .single();

    if (updErr || !obraAtualizada) throw new Error(updErr?.message || 'Erro ao atualizar dados da obra.');

    return { obra: obraAtualizada };
  });

/**
 * 4. Criar lote em uma obra.
 */
export const criarLote = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: {
    obraId: string;
    tipo: TipoLote;
    descricao?: string | null | undefined;
    quantidade?: number | null | undefined;
  }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    if (!data.obraId) throw new Error('ID da obra não informado.');
    if (!data.tipo) throw new Error('Tipo de lote não informado.');

    const { data: obra, error: obraErr } = await supabase
      .from('obras')
      .select('id, cliente_id')
      .eq('id', data.obraId)
      .single();

    if (obraErr || !obra) throw new Error(obraErr?.message || 'Obra não encontrada.');

    const { data: novoLote, error: loteErr } = await supabase
      .from('lotes')
      .insert({
        obra_id: data.obraId,
        tipo: data.tipo,
        descricao: data.descricao?.trim() || null,
        quantidade: data.quantidade ?? null,
      })
      .select()
      .single();

    if (loteErr || !novoLote) throw new Error(loteErr?.message || 'Erro ao criar lote.');

    const tipoLegivel = TIPOS_LOTE_LABELS[data.tipo] || data.tipo;
    const descTexto = data.descricao?.trim() ? ` ${data.descricao.trim()}` : '';

    const { error: regErr } = await supabase.from('registros').insert({
      obra_id: data.obraId,
      lote_id: novoLote.id,
      cliente_id: obra.cliente_id,
      tipo: 'nota',
      direcao: 'nenhuma',
      texto: `Lote criado: ${tipoLegivel}${descTexto}`,
    });

    if (regErr) throw new Error(regErr.message);

    return { lote: novoLote };
  });

/**
 * 5. Editar lote existente com validações de regras operacionais.
 */
export const editarLote = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: {
    loteId: string;
    obraId?: string | undefined;
    descricao?: string | null | undefined;
    quantidade?: number | null | undefined;
    cadastro_completo?: boolean | undefined;
    previsao_medicao?: string | null | undefined;
    medido_em?: string | null | undefined;
    status?: StatusLote | undefined;
    data_confirmada?: string | null | undefined;
    recebimento_confirmado?: boolean | undefined;
    responsavel_recebimento?: string | null | undefined;
    entregue_em?: string | null | undefined;
  }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    if (!data.loteId) throw new Error('ID do lote não informado.');

    // 1. Buscar lote e verificar pertencimento
    const { data: loteAtual, error: loteErr } = await supabase
      .from('lotes')
      .select('*')
      .eq('id', data.loteId)
      .single();

    if (loteErr || !loteAtual) throw new Error(loteErr?.message || 'Lote não encontrado.');
    if (data.obraId && loteAtual.obra_id !== data.obraId) {
      throw new Error('O lote não pertence à obra informada.');
    }

    // 2. Buscar cliente_id da obra
    const { data: obra, error: obraErr } = await supabase
      .from('obras')
      .select('id, cliente_id')
      .eq('id', loteAtual.obra_id)
      .single();

    if (obraErr || !obra) throw new Error(obraErr?.message || 'Obra não encontrada.');

    const novoCadastroCompleto =
      data.cadastro_completo !== undefined
        ? data.cadastro_completo
        : loteAtual.cadastro_completo;
    const novoMedidoEm =
      data.medido_em !== undefined ? data.medido_em : loteAtual.medido_em;
    const novoEntregueEm =
      data.entregue_em !== undefined ? data.entregue_em : loteAtual.entregue_em;

    // Regra: não aceite medido_em se o cadastro não estiver completo. Mensagem: "Complete o cadastro do lote antes da medição."
    if (novoMedidoEm && !novoCadastroCompleto) {
      throw new Error('Complete o cadastro do lote antes da medição.');
    }

    // Regra: status manual só aceita 'pcp', 'em_producao' ou 'produzido', e só se o lote já tiver medido_em.
    if (data.status !== undefined && data.status !== loteAtual.status) {
      const statusManuaisPermitidos: StatusLote[] = ['pcp', 'em_producao', 'produzido'];
      if (!statusManuaisPermitidos.includes(data.status)) {
        throw new Error('Status manual só aceita PCP, Em produção ou Produzido.');
      }
      if (!novoMedidoEm) {
        throw new Error('O lote precisa ter data de medição antes de atualizar a produção.');
      }
    }

    // Regra: não aceite entregue_em sem medido_em.
    if (novoEntregueEm && !novoMedidoEm) {
      throw new Error('Não é possível registrar entrega sem o lote ter sido medido.');
    }

    // 3. Montar payload de atualização
    const updates: any = {};
    if (data.descricao !== undefined) updates.descricao = data.descricao?.trim() || null;
    if (data.quantidade !== undefined) updates.quantidade = data.quantidade ?? null;
    if (data.cadastro_completo !== undefined) updates.cadastro_completo = data.cadastro_completo;
    if (data.previsao_medicao !== undefined) updates.previsao_medicao = data.previsao_medicao || null;
    if (data.medido_em !== undefined) updates.medido_em = data.medido_em || null;
    if (data.status !== undefined) updates.status = data.status;
    if (data.data_confirmada !== undefined) updates.data_confirmada = data.data_confirmada || null;
    if (data.recebimento_confirmado !== undefined) updates.recebimento_confirmado = data.recebimento_confirmado;
    if (data.responsavel_recebimento !== undefined) updates.responsavel_recebimento = data.responsavel_recebimento?.trim() || null;
    if (data.entregue_em !== undefined) updates.entregue_em = data.entregue_em || null;

    const { data: loteAtualizado, error: updErr } = await supabase
      .from('lotes')
      .update(updates)
      .eq('id', data.loteId)
      .select()
      .single();

    if (updErr || !loteAtualizado) throw new Error(updErr?.message || 'Erro ao atualizar lote.');

    // 4. Se medido_em, entregue_em ou status mudarem, gravar registro tipo 'nota'
    const tipoLegivel = TIPOS_LOTE_LABELS[loteAtualizado.tipo] || loteAtualizado.tipo;

    if (loteAtual.medido_em !== loteAtualizado.medido_em) {
      const msg = loteAtualizado.medido_em
        ? `Lote ${tipoLegivel}: medido em ${formatarData(loteAtualizado.medido_em)}`
        : `Lote ${tipoLegivel}: medição removida`;
      const { error: rErr } = await supabase.from('registros').insert({
        obra_id: loteAtualizado.obra_id,
        lote_id: loteAtualizado.id,
        cliente_id: obra.cliente_id,
        tipo: 'nota',
        direcao: 'nenhuma',
        texto: msg,
      });
      if (rErr) throw new Error(rErr.message);
    }

    if (loteAtual.entregue_em !== loteAtualizado.entregue_em) {
      const respInfo = loteAtualizado.responsavel_recebimento
        ? ` (recebido por ${loteAtualizado.responsavel_recebimento})`
        : '';
      const msg = loteAtualizado.entregue_em
        ? `Lote ${tipoLegivel}: entregue em ${formatarData(loteAtualizado.entregue_em)}${respInfo}`
        : `Lote ${tipoLegivel}: entrega desfeita`;
      const { error: rErr } = await supabase.from('registros').insert({
        obra_id: loteAtualizado.obra_id,
        lote_id: loteAtualizado.id,
        cliente_id: obra.cliente_id,
        tipo: 'nota',
        direcao: 'nenhuma',
        texto: msg,
      });
      if (rErr) throw new Error(rErr.message);
    }

    if (data.status !== undefined && data.status !== loteAtual.status) {
      const statusNome = STATUS_LOTE_LABELS[loteAtualizado.status] || loteAtualizado.status;
      const msg = `Lote ${tipoLegivel}: status alterado para ${statusNome}`;
      const { error: rErr } = await supabase.from('registros').insert({
        obra_id: loteAtualizado.obra_id,
        lote_id: loteAtualizado.id,
        cliente_id: obra.cliente_id,
        tipo: 'nota',
        direcao: 'nenhuma',
        texto: msg,
      });
      if (rErr) throw new Error(rErr.message);
    }

    return { lote: loteAtualizado };
  });

/**
 * 6. Marcar item do checklist (feito=true grava hoje SP; feito=false limpa).
 */
export const marcarItemChecklist = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: {
    itemId: string;
    feito: boolean;
    data?: string | null | undefined;
    nota?: string | null | undefined;
    obraId?: string | undefined;
  }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    if (!data.itemId) throw new Error('ID do item de checklist não informado.');

    const { data: item, error: itemErr } = await supabase
      .from('checklist_itens')
      .select('*')
      .eq('id', data.itemId)
      .single();

    if (itemErr || !item) throw new Error(itemErr?.message || 'Item do checklist não encontrado.');
    if (data.obraId && item.obra_id !== data.obraId) {
      throw new Error('O item não pertence à obra informada.');
    }

    const updates: any = {
      feito: data.feito,
      feito_em: data.feito ? (data.data || obterHojeSP()) : null,
    };
    if (data.nota !== undefined) {
      updates.nota = data.nota?.trim() || null;
    }

    const { data: itemAtualizado, error: updErr } = await supabase
      .from('checklist_itens')
      .update(updates)
      .eq('id', data.itemId)
      .select()
      .single();

    if (updErr || !itemAtualizado) throw new Error(updErr?.message || 'Erro ao atualizar checklist.');

    return { item: itemAtualizado };
  });

/**
 * 7. Marcar e resolver problemas na obra via RPCs.
 */
export const marcarProblema = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: { obraId: string; texto: string }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    const textoLimpo = data.texto?.trim();
    if (!data.obraId) throw new Error('ID da obra não informado.');
    if (!textoLimpo) throw new Error('Informe o texto descrevendo o problema.');

    const { error } = await supabase.rpc('marcar_problema', {
      p_obra_id: data.obraId,
      p_texto: textoLimpo,
    });

    if (error) throw new Error(error.message);
    return { success: true };
  });

export const resolverProblema = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: { obraId: string }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    if (!data.obraId) throw new Error('ID da obra não informado.');

    const { error } = await supabase.rpc('resolver_problema', {
      p_obra_id: data.obraId,
    });

    if (error) throw new Error(error.message);
    return { success: true };
  });

/**
 * 8. Registrar nota / histórico na obra.
 */
export const registrarNotaObra = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: {
    obraId: string;
    loteId?: string | null | undefined;
    tipo: TipoRegistro;
    texto: string;
    data?: string | null | undefined;
  }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    const tiposPermitidos: TipoRegistro[] = [
      'nota',
      'ata',
      'cronograma',
      'medicao',
      'ligacao',
      'whatsapp',
      'email',
      'visita',
      'outro',
    ];
    if (!tiposPermitidos.includes(data.tipo)) {
      throw new Error('Tipo de registro inválido para obra.');
    }

    const textoLimpo = data.texto?.trim();
    if (!textoLimpo) throw new Error('Informe o texto do registro.');
    if (!data.obraId) throw new Error('ID da obra não informado.');

    const { data: obra, error: obraErr } = await supabase
      .from('obras')
      .select('id, cliente_id')
      .eq('id', data.obraId)
      .single();

    if (obraErr || !obra) throw new Error(obraErr?.message || 'Obra não encontrada.');

    if (data.loteId) {
      const { data: lote, error: loteErr } = await supabase
        .from('lotes')
        .select('id, obra_id')
        .eq('id', data.loteId)
        .single();

      if (loteErr || !lote) throw new Error(loteErr?.message || 'Lote não encontrado.');
      if (lote.obra_id !== data.obraId) {
        throw new Error('O lote selecionado não pertence a esta obra.');
      }
    }

    const insertPayload: any = {
      obra_id: data.obraId,
      lote_id: data.loteId || null,
      cliente_id: obra.cliente_id,
      tipo: data.tipo,
      direcao: 'nenhuma',
      texto: textoLimpo,
    };

    if (data.data) {
      insertPayload.data = `${data.data}T12:00:00-03:00`;
    }

    const { data: novoRegistro, error: regErr } = await supabase
      .from('registros')
      .insert(insertPayload)
      .select()
      .single();

    if (regErr || !novoRegistro) throw new Error(regErr?.message || 'Erro ao gravar registro.');

    return { registro: novoRegistro };
  });

/**
 * 8.1 Criar follow-up específico da obra.
 */
export const criarFollowupObra = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: {
    obraId: string;
    loteId?: string | null | undefined;
    data: string;
    motivo: string;
  }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    if (!data.obraId) throw new Error('ID da obra não informado.');
    if (!data.data) throw new Error('Data do follow-up não informada.');
    if (!data.motivo?.trim()) throw new Error('Motivo do follow-up não informado.');

    const { data: obra, error: obraErr } = await supabase
      .from('obras')
      .select('id, cliente_id')
      .eq('id', data.obraId)
      .single();

    if (obraErr || !obra) throw new Error(obraErr?.message || 'Obra não encontrada.');

    if (data.loteId) {
      const { data: lote, error: loteErr } = await supabase
        .from('lotes')
        .select('id, obra_id')
        .eq('id', data.loteId)
        .single();
      if (loteErr || !lote) throw new Error('Lote não encontrado.');
      if (lote.obra_id !== data.obraId) {
        throw new Error('O lote selecionado não pertence a esta obra.');
      }
    }

    const { data: novoFup, error: insErr } = await supabase
      .from('followups')
      .insert({
        obra_id: data.obraId,
        cliente_id: obra.cliente_id,
        lote_id: data.loteId || null,
        data: data.data,
        motivo: data.motivo.trim(),
        origem: 'obra',
        status: 'pendente',
      })
      .select()
      .single();

    if (insErr || !novoFup) throw new Error(insErr?.message || 'Erro ao criar follow-up da obra.');

    return { followup: novoFup };
  });

/**
 * 9. Finalizar e reabrir obra.
 */
export const finalizarObra = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: { obraId: string; data: string }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    if (!data.obraId) throw new Error('ID da obra não informado.');
    if (!data.data) throw new Error('Informe a data de finalização.');

    const { data: obra, error: obraErr } = await supabase
      .from('obras')
      .select('id, cliente_id')
      .eq('id', data.obraId)
      .single();

    if (obraErr || !obra) throw new Error(obraErr?.message || 'Obra não encontrada.');

    const { error: updErr } = await supabase
      .from('obras')
      .update({ finalizada_em: data.data })
      .eq('id', data.obraId);

    if (updErr) throw new Error(updErr.message);

    const { error: regErr } = await supabase.from('registros').insert({
      obra_id: data.obraId,
      cliente_id: obra.cliente_id,
      tipo: 'nota',
      direcao: 'nenhuma',
      texto: `Obra finalizada em ${formatarData(data.data)}`,
    });

    if (regErr) throw new Error(regErr.message);

    return { success: true };
  });

export const reabrirObra = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: { obraId: string }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    if (!data.obraId) throw new Error('ID da obra não informado.');

    const { data: obra, error: obraErr } = await supabase
      .from('obras')
      .select('id, cliente_id')
      .eq('id', data.obraId)
      .single();

    if (obraErr || !obra) throw new Error(obraErr?.message || 'Obra não encontrada.');

    const { error: updErr } = await supabase
      .from('obras')
      .update({ finalizada_em: null })
      .eq('id', data.obraId);

    if (updErr) throw new Error(updErr.message);

    // Cancelar a revisão de 40 dias pendente desta obra
    const { error: cancelFupErr } = await supabase
      .from('followups')
      .update({ status: 'cancelado' })
      .eq('obra_id', data.obraId)
      .eq('status', 'pendente')
      .eq('origem', 'automatico')
      .like('motivo', 'Revisão de 40 dias%');

    if (cancelFupErr) throw new Error(cancelFupErr.message);

    const { error: regErr } = await supabase.from('registros').insert({
      obra_id: data.obraId,
      cliente_id: obra.cliente_id,
      tipo: 'nota',
      direcao: 'nenhuma',
      texto: 'Obra reaberta',
    });

    if (regErr) throw new Error(regErr.message);

    return { success: true };
  });

/**
 * 10. Registrar arquivo associado à obra no banco.
 */
export const registrarArquivo = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: {
    obraId: string;
    loteId?: string | null | undefined;
    registroId?: string | null | undefined;
    nome: string;
    mime?: string | null | undefined;
    tamanho?: number | null | undefined;
    caminho: string;
  }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    if (!data.obraId) throw new Error('ID da obra não informado.');
    if (!data.caminho.startsWith(`obras/${data.obraId}/`)) {
      throw new Error(`Caminho inválido. O arquivo deve começar com obras/${data.obraId}/.`);
    }

    const { data: obra, error: obraErr } = await supabase
      .from('obras')
      .select('id')
      .eq('id', data.obraId)
      .single();

    if (obraErr || !obra) throw new Error(obraErr?.message || 'Obra não encontrada.');

    if (data.loteId) {
      const { data: lote, error: loteErr } = await supabase
        .from('lotes')
        .select('id, obra_id')
        .eq('id', data.loteId)
        .single();

      if (loteErr || !lote) throw new Error(loteErr?.message || 'Lote não encontrado.');
      if (lote.obra_id !== data.obraId) {
        throw new Error('O lote selecionado não pertence a esta obra.');
      }
    }

    if (data.registroId) {
      const { data: reg, error: regErr } = await supabase
        .from('registros')
        .select('id, obra_id')
        .eq('id', data.registroId)
        .single();

      if (regErr || !reg) throw new Error(regErr?.message || 'Registro não encontrado.');
      if (reg.obra_id !== data.obraId) {
        throw new Error('O registro selecionado não pertence a esta obra.');
      }
    }

    const { data: novoArquivo, error: arqErr } = await supabase
      .from('arquivos')
      .insert({
        obra_id: data.obraId,
        lote_id: data.loteId || null,
        registro_id: data.registroId || null,
        nome: data.nome.trim(),
        mime: data.mime || null,
        tamanho: data.tamanho ?? null,
        caminho: data.caminho,
      })
      .select()
      .single();

    if (arqErr || !novoArquivo) throw new Error(arqErr?.message || 'Erro ao registrar arquivo.');

    return { arquivo: novoArquivo };
  });

/**
 * 11. Gerar link assinado (URL temporária) para visualização/download de arquivo.
 */
export const linkArquivo = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: { arquivoId: string }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    if (!data.arquivoId) throw new Error('ID do arquivo não informado.');

    const { data: arq, error: arqErr } = await supabase
      .from('arquivos')
      .select('caminho')
      .eq('id', data.arquivoId)
      .single();

    if (arqErr || !arq) throw new Error(arqErr?.message || 'Arquivo não encontrado.');

    const { data: signed, error: signErr } = await supabase.storage
      .from('arquivos')
      .createSignedUrl(arq.caminho, 300);

    if (signErr || !signed) throw new Error(signErr?.message || 'Erro ao gerar link do arquivo.');

    return { url: signed.signedUrl };
  });

/**
 * 12. Excluir arquivo do storage e da tabela arquivos.
 */
export const excluirArquivo = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: { arquivoId: string }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    if (!data.arquivoId) throw new Error('ID do arquivo não informado.');

    const { data: arq, error: arqErr } = await supabase
      .from('arquivos')
      .select('id, caminho')
      .eq('id', data.arquivoId)
      .single();

    if (arqErr || !arq) throw new Error(arqErr?.message || 'Arquivo não encontrado.');

    // Remove do bucket de storage
    const { error: storageErr } = await supabase.storage
      .from('arquivos')
      .remove([arq.caminho]);

    if (storageErr) throw new Error(storageErr.message);

    // Remove da tabela arquivos
    const { error: delErr } = await supabase
      .from('arquivos')
      .delete()
      .eq('id', data.arquivoId);

    if (delErr) throw new Error(delErr.message);

    return { success: true };
  });
