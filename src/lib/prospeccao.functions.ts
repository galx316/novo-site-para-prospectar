import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Database } from '@/integrations/supabase/types';

type TipoRegistro = Database['public']['Enums']['tipo_registro'];
type SituacaoPrado = Database['public']['Enums']['situacao_prado'];
type EtapaComercial = Database['public']['Enums']['etapa_comercial'];

async function assertAuthorized(supabase: any) {
  const { data: authorized, error } = await supabase.rpc('is_authorized');
  if (error) throw new Error(error.message);
  if (!authorized) throw new Error('Seu e-mail não está autorizado no sistema.');
}

/**
 * Listagem principal de prospects para a tela /prospeccao
 */
export const listarProspects = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .validator((data?: {
    texto?: string | undefined;
    marcaId?: string | undefined;
    etapa?: string | undefined;
    situacao?: SituacaoPrado | undefined;
    apenasOutroRep?: boolean | undefined;
    apenasSemProximoPasso?: boolean | undefined;
  } | undefined) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    const texto = data?.texto?.trim() || '';

    // 1. Buscar todas as marcas (para enriquecer histórico) e configurações
    const [marcasRes, configRes] = await Promise.all([
      supabase.from('marcas').select('*').order('nome'),
      supabase.from('configuracoes').select('*').eq('id', 1).single(),
    ]);

    if (marcasRes.error) throw new Error(marcasRes.error.message);
    const marcas = marcasRes.data || [];
    const marcasMap = new Map(marcas.map((m: any) => [m.id, m]));

    // 2. Buscar clientes (via RPC se houver busca, ou direto na tabela)
    let clientesList: any[] = [];
    if (texto) {
      const { data: buscados, error: buscaErr } = await supabase.rpc('buscar_clientes', {
        p_texto: texto,
        p_limite: 100,
      });
      if (buscaErr) throw new Error(buscaErr.message);

      if (buscados && buscados.length > 0) {
        const ids = buscados.map((b: any) => b.id);
        const { data: clientesCompletos, error: clientesErr } = await supabase
          .from('clientes')
          .select('*')
          .in('id', ids);
        if (clientesErr) throw new Error(clientesErr.message);

        // Manter a ordenação por relevância da similaridade
        const mapCompleto = new Map((clientesCompletos || []).map((c: any) => [c.id, c]));
        clientesList = buscados.map((b: any) => mapCompleto.get(b.id)).filter(Boolean);
      }
    } else {
      let query = supabase.from('clientes').select('*').order('updated_at', { ascending: false }).limit(200);
      if (data?.situacao) {
        query = query.eq('situacao_prado', data.situacao);
      } else if (data?.apenasOutroRep) {
        query = query.eq('situacao_prado', 'atendida_outro_rep');
      }
      const { data: todosClientes, error: errTodos } = await query;
      if (errTodos) throw new Error(errTodos.message);
      clientesList = todosClientes || [];
    }

    if (clientesList.length === 0) {
      return { prospects: [], marcas, configuracoes: configRes.data };
    }

    const clienteIds = clientesList.map((c: any) => c.id);

    // 3. Buscar contatos, oportunidades e follow-ups pendentes para esses clientes
    const [contatosRes, oportunidadesRes, followupsRes] = await Promise.all([
      supabase.from('contatos').select('*').in('cliente_id', clienteIds).order('created_at', { ascending: true }),
      supabase.from('oportunidades').select('*').in('cliente_id', clienteIds).order('created_at', { ascending: false }),
      supabase
        .from('followups')
        .select('*')
        .in('cliente_id', clienteIds)
        .eq('status', 'pendente')
        .order('data', { ascending: true }),
    ]);

    if (contatosRes.error) throw new Error(contatosRes.error.message);
    if (oportunidadesRes.error) throw new Error(oportunidadesRes.error.message);
    if (followupsRes.error) throw new Error(followupsRes.error.message);

    // Agrupar contatos por cliente_id
    const contatosPorCliente = new Map<string, any[]>();
    for (const c of contatosRes.data || []) {
      if (!c.cliente_id) continue;
      const list = contatosPorCliente.get(c.cliente_id) || [];
      list.push(c);
      contatosPorCliente.set(c.cliente_id, list);
    }

    // Agrupar oportunidades por cliente_id e enriquecer com marcas
    const opsPorCliente = new Map<string, any[]>();
    for (const op of oportunidadesRes.data || []) {
      if (!op.cliente_id) continue;
      const opMarcas = (op.marca_ids || []).map((id: string) => marcasMap.get(id)).filter(Boolean);
      const list = opsPorCliente.get(op.cliente_id) || [];
      list.push({ ...op, marcas: opMarcas });
      opsPorCliente.set(op.cliente_id, list);
    }

    // Agrupar follow-up pendente mais próximo por cliente_id
    const followupPorCliente = new Map<string, any>();
    for (const f of followupsRes.data || []) {
      if (!f.cliente_id) continue;
      if (!followupPorCliente.has(f.cliente_id)) {
        followupPorCliente.set(f.cliente_id, f);
      }
    }

    // Montar prospects estruturados
    let prospects = clientesList.map((cliente: any) => {
      const contatos = contatosPorCliente.get(cliente.id) || [];
      const oportunidades = opsPorCliente.get(cliente.id) || [];
      const followupPendente = followupPorCliente.get(cliente.id) || null;

      // Obter marcas consolidadas das oportunidades
      const marcasUnicasMap = new Map<string, any>();
      oportunidades.forEach((op: any) => {
        op.marcas.forEach((m: any) => {
          if (!marcasUnicasMap.has(m.id)) {
            marcasUnicasMap.set(m.id, m);
          }
        });
      });

      // Etapa principal (da oportunidade mais recente ou do follow-up)
      const etapaPrincipal: EtapaComercial = oportunidades[0]?.etapa || 'prospeccao';

      return {
        id: cliente.id,
        nome: cliente.nome,
        cidade: cliente.cidade,
        uf: cliente.uf,
        situacao_prado: cliente.situacao_prado,
        representante_prado: cliente.representante_prado,
        contatos,
        contato_principal: contatos[0] || null,
        oportunidades,
        oportunidade_principal: oportunidades[0] || null,
        marcas: Array.from(marcasUnicasMap.values()),
        etapa: etapaPrincipal,
        followup_pendente: followupPendente,
      };
    });

    // 4. Aplicar filtros em memória
    if (data?.marcaId) {
      prospects = prospects.filter((p: any) => p.marcas.some((m: any) => m.id === data.marcaId));
    }

    if (data?.etapa) {
      prospects = prospects.filter((p: any) => p.oportunidades.some((op: any) => op.etapa === data.etapa));
    }

    if (data?.situacao) {
      prospects = prospects.filter((p: any) => p.situacao_prado === data.situacao);
    } else if (data?.apenasOutroRep) {
      prospects = prospects.filter((p: any) => p.situacao_prado === 'atendida_outro_rep');
    }

    if (data?.apenasSemProximoPasso) {
      prospects = prospects.filter((p: any) => !p.followup_pendente);
    }

    return {
      prospects,
      marcas,
      configuracoes: configRes.data,
    };
  });

/**
 * Detalhes da ficha do cliente (/prospeccao/$clienteId)
 */
export const obterFichaCliente = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .validator((data: { clienteId: string }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    const { clienteId } = data;
    if (!clienteId) throw new Error('ID do cliente não informado.');

    const [clienteRes, contatosRes, oportunidadesRes, followupsRes, registrosRes, marcasRes, configRes] =
      await Promise.all([
        supabase.from('clientes').select('*').eq('id', clienteId).single(),
        supabase.from('contatos').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: true }),
        supabase.from('oportunidades').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }),
        supabase
          .from('followups')
          .select('*')
          .eq('cliente_id', clienteId)
          .eq('status', 'pendente')
          .order('data', { ascending: true }),
        supabase
          .from('registros')
          .select('*, contatos(nome), oportunidades(descricao)')
          .eq('cliente_id', clienteId)
          .order('data', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase.from('marcas').select('*').order('nome'),
        supabase.from('configuracoes').select('*').eq('id', 1).single(),
      ]);

    if (clienteRes.error) throw new Error('Cliente não encontrado.');
    if (contatosRes.error) throw new Error(contatosRes.error.message);
    if (oportunidadesRes.error) throw new Error(oportunidadesRes.error.message);
    if (registrosRes.error) throw new Error(registrosRes.error.message);
    if (marcasRes.error) throw new Error(marcasRes.error.message);

    const marcas = marcasRes.data || [];
    const marcasMap = new Map(marcas.map((m: any) => [m.id, m]));

    const oportunidades = (oportunidadesRes.data || []).map((op: any) => ({
      ...op,
      marcas: (op.marca_ids || []).map((id: string) => marcasMap.get(id)).filter(Boolean),
    }));

    return {
      cliente: clienteRes.data,
      contatos: contatosRes.data || [],
      oportunidades,
      followups_pendentes: followupsRes.data || [],
      followup_destaque: followupsRes.data?.[0] || null,
      registros: registrosRes.data || [],
      marcas,
      configuracoes: configRes.data,
    };
  });

/**
 * Busca de clientes por similaridade com buscar_clientes(texto)
 */
export const buscarClientesRPC = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .validator((data: { texto: string; limite?: number | undefined }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    const { data: resultados, error } = await supabase.rpc('buscar_clientes', {
      p_texto: data.texto || '',
      p_limite: data.limite || 10,
    });
    if (error) throw new Error(error.message);
    return resultados || [];
  });

/**
 * Criação de prospect (modal Novo Prospect) com prevenção de erros técnicos
 */
export const criarProspect = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: {
    usarClienteId?: string | undefined;
    nomeCliente?: string | undefined;
    cidade?: string | undefined;
    uf?: string | undefined;
    nomeContato: string;
    cargo?: string | undefined;
    telefone?: string | undefined;
    whatsapp?: string | undefined;
    email?: string | undefined;
    marcaIds: string[];
    descricao?: string | undefined;
    situacaoPrado?: SituacaoPrado | undefined;
    representantePrado?: string | undefined;
    jaEnviouApresentacao?: boolean | undefined;
    canalEnvio?: TipoRegistro | undefined;
    dataProximaEnvio?: string | undefined;
  }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    const whatsappLimpo = data.whatsapp?.trim();
    const emailLimpo = data.email?.trim()?.toLowerCase();

    // 0. Antes de criar a construtora, confira se o WhatsApp já existe (rpc buscar_contato_por_whatsapp)
    // e se o e-mail já existe (select em contatos por email em minúsculas).
    if (whatsappLimpo) {
      const { data: respWa, error: errWa } = await supabase.rpc('buscar_contato_por_whatsapp', {
        p_numero: whatsappLimpo,
      });
      if (errWa) throw new Error(errWa.message);
      if (respWa && typeof respWa === 'object') {
        const info = respWa as any;
        const clienteExistente = info.cliente;
        const clienteNome = clienteExistente?.nome || 'Construtora já cadastrada';
        const clienteIdExistente = clienteExistente?.id || info.contato?.cliente_id;
        return {
          success: false,
          erro: 'contato_duplicado',
          mensagem: `Este WhatsApp já está cadastrado para o contato da construtora "${clienteNome}".`,
          clienteExistenteId: clienteIdExistente,
          clienteNome,
        };
      }
    }

    if (emailLimpo) {
      const { data: contatosEmail, error: errEmail } = await supabase
        .from('contatos')
        .select('id, cliente_id, clientes(id, nome)')
        .eq('email', emailLimpo)
        .limit(1);

      if (errEmail) throw new Error(errEmail.message);
      if (contatosEmail && contatosEmail.length > 0) {
        const contatoExistente = contatosEmail[0] as any;
        const clienteExistente = contatoExistente.clientes;
        const clienteNome = clienteExistente?.nome || 'Construtora já cadastrada';
        const clienteIdExistente = clienteExistente?.id || contatoExistente.cliente_id;
        return {
          success: false,
          erro: 'contato_duplicado',
          mensagem: `Este e-mail já está cadastrado para o contato da construtora "${clienteNome}".`,
          clienteExistenteId: clienteIdExistente,
          clienteNome,
        };
      }
    }

    let clienteId = data.usarClienteId;
    let clienteCriadoNestaChamadaId: string | null = null;
    let contatoCriadoNestaChamadaId: string | null = null;
    let oportunidadeCriadaNestaChamadaId: string | null = null;

    // 1. Criar construtora se não estiver usando existente
    if (!clienteId) {
      const nomeLimpo = data.nomeCliente?.trim();
      if (!nomeLimpo) {
        return { success: false, erro: 'nome_obrigatorio', mensagem: 'Informe o nome da construtora.' };
      }

      const { data: novoCliente, error: clienteErr } = await supabase
        .from('clientes')
        .insert({
          nome: nomeLimpo,
          nome_normalizado: nomeLimpo,
          cidade: data.cidade?.trim() || null,
          uf: data.uf?.trim()?.toUpperCase() || null,
          situacao_prado: data.situacaoPrado || 'nao_verificado',
          representante_prado: data.representantePrado?.trim() || null,
        })
        .select()
        .single();

      if (clienteErr) {
        // Código 23505 = violação de chave única (nome_normalizado)
        if (clienteErr.code === '23505') {
          const { data: existentes } = await supabase.rpc('buscar_clientes', {
            p_texto: nomeLimpo,
            p_limite: 1,
          });
          const existente = existentes?.[0];
          return {
            success: false,
            erro: 'cliente_duplicado',
            mensagem: `A construtora "${nomeLimpo}" já está cadastrada no sistema.`,
            clienteExistente: existente || null,
          };
        }
        throw new Error(clienteErr.message);
      }

      clienteId = novoCliente.id;
      clienteCriadoNestaChamadaId = novoCliente.id;
    }

    // Bloco para criação de contato, oportunidade e envio.
    try {
      // 2. Criar contato
      const { data: novoContato, error: contatoErr } = await supabase
        .from('contatos')
        .insert({
          cliente_id: clienteId,
          nome: data.nomeContato.trim(),
          cargo: data.cargo?.trim() || null,
          telefone: data.telefone?.trim() || null,
          whatsapp: data.whatsapp?.trim() || null,
          email: data.email?.trim() || null,
        })
        .select()
        .single();

      if (contatoErr) {
        throw new Error(contatoErr.message);
      }
      contatoCriadoNestaChamadaId = novoContato.id;

      // 3. Criar oportunidade
      if (!data.marcaIds || data.marcaIds.length === 0) {
        throw new Error('Selecione pelo menos uma marca para a oportunidade.');
      }

      const { data: novaOp, error: opErr } = await supabase
        .from('oportunidades')
        .insert({
          cliente_id: clienteId,
          contato_id: novoContato.id,
          marca_ids: data.marcaIds,
          descricao: data.descricao?.trim() || null,
          etapa: 'prospeccao',
        })
        .select()
        .single();

      if (opErr) throw new Error(opErr.message);
      oportunidadeCriadaNestaChamadaId = novaOp.id;

      // 4. Se já enviou a apresentação, registrar o envio chamando a RPC registrar_envio
      if (data.jaEnviouApresentacao) {
        const canal = data.canalEnvio || 'whatsapp';
        const { error: envioErr } = await supabase.rpc('registrar_envio', {
          p_contato_id: novoContato.id,
          p_canal: canal,
          p_oportunidade_id: novaOp.id,
          p_texto: 'Apresentação enviada no cadastro inicial.',
          ...(data.dataProximaEnvio ? { p_data_proxima: data.dataProximaEnvio } : {}),
        });
        if (envioErr) throw new Error(envioErr.message);
      }

      return {
        success: true,
        clienteId,
        contatoId: novoContato.id,
        oportunidadeId: novaOp.id,
      };
    } catch (err: any) {
      const errosRollback: string[] = [];

      // Apague nesta ordem: followups e registros do contato criado, a oportunidade criada, o contato criado e por último a construtora criada.
      // Só apague o que foi criado nesta chamada.
      // Confira o erro de cada delete. Se algum falhar, inclua isso na mensagem de erro retornada.
      if (contatoCriadoNestaChamadaId) {
        const { error: errDelFollowups } = await supabase
          .from('followups')
          .delete()
          .eq('contato_id', contatoCriadoNestaChamadaId);
        if (errDelFollowups) {
          errosRollback.push(`Falha ao remover follow-ups: ${errDelFollowups.message}`);
        }

        const { error: errDelRegistros } = await supabase
          .from('registros')
          .delete()
          .eq('contato_id', contatoCriadoNestaChamadaId);
        if (errDelRegistros) {
          errosRollback.push(`Falha ao remover registros: ${errDelRegistros.message}`);
        }
      }

      if (oportunidadeCriadaNestaChamadaId) {
        const { error: errDelOp } = await supabase
          .from('oportunidades')
          .delete()
          .eq('id', oportunidadeCriadaNestaChamadaId);
        if (errDelOp) {
          errosRollback.push(`Falha ao remover oportunidade: ${errDelOp.message}`);
        }
      }

      if (contatoCriadoNestaChamadaId) {
        const { error: errDelContato } = await supabase
          .from('contatos')
          .delete()
          .eq('id', contatoCriadoNestaChamadaId);
        if (errDelContato) {
          errosRollback.push(`Falha ao remover contato: ${errDelContato.message}`);
        }
      }

      if (clienteCriadoNestaChamadaId) {
        const { error: errDelCliente } = await supabase
          .from('clientes')
          .delete()
          .eq('id', clienteCriadoNestaChamadaId);
        if (errDelCliente) {
          errosRollback.push(`Falha ao remover construtora: ${errDelCliente.message}`);
        }
      }

      const mensagemBase = err?.message || 'Erro ao criar prospect.';
      if (errosRollback.length > 0) {
        throw new Error(`${mensagemBase} (Erros no rollback: ${errosRollback.join('; ')})`);
      }
      throw new Error(mensagemBase);
    }
  });

/**
 * RPC registrar_envio
 */
export const registrarEnvio = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: {
    contatoId: string;
    canal: TipoRegistro;
    oportunidadeId?: string | undefined;
    texto?: string | undefined;
    dataProxima?: string | undefined;
  }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    const { error } = await supabase.rpc('registrar_envio', {
      p_contato_id: data.contatoId,
      p_canal: data.canal,
      ...(data.oportunidadeId ? { p_oportunidade_id: data.oportunidadeId } : {}),
      ...(data.texto?.trim() ? { p_texto: data.texto.trim() } : {}),
      ...(data.dataProxima ? { p_data_proxima: data.dataProxima } : {}),
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

/**
 * RPC registrar_resposta
 */
export const registrarResposta = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: {
    contatoId: string;
    canal: TipoRegistro;
    situacao: 'tem_demanda' | 'demanda_prevista' | 'sem_demanda' | 'atendido_outro_rep_prado' | 'falar_depois' | 'sem_interesse';
    oportunidadeId?: string | undefined;
    necessidade?: string | undefined;
    dataProxima?: string | undefined;
    representante?: string | undefined;
    texto?: string | undefined;
  }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    const { error } = await supabase.rpc('registrar_resposta', {
      p_contato_id: data.contatoId,
      p_canal: data.canal,
      p_situacao: data.situacao,
      ...(data.oportunidadeId ? { p_oportunidade_id: data.oportunidadeId } : {}),
      ...(data.necessidade ? { p_necessidade: data.necessidade } : {}),
      ...(data.dataProxima ? { p_data_proxima: data.dataProxima } : {}),
      ...(data.representante?.trim() ? { p_representante: data.representante.trim() } : {}),
      ...(data.texto?.trim() ? { p_texto: data.texto.trim() } : {}),
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

/**
 * RPC remarcar_followup
 */
export const remarcarFollowup = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; data: string }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    if (!data.data) throw new Error('Informe a nova data.');
    const { error } = await supabase.rpc('remarcar_followup', {
      p_id: data.id,
      p_data: data.data,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

/**
 * RPC concluir_followup
 */
export const concluirFollowup = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    const { error } = await supabase.rpc('concluir_followup', {
      p_id: data.id,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

/**
 * RPC cancelar_followup
 */
export const cancelarFollowup = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    const { error } = await supabase.rpc('cancelar_followup', {
      p_id: data.id,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

/**
 * RPC mesclar_clientes
 */
export const mesclarClientes = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: { manterId: string; removerId: string }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    if (data.manterId === data.removerId) {
      throw new Error('Selecione duas construtoras diferentes para mesclar.');
    }

    const { error } = await supabase.rpc('mesclar_clientes', {
      p_manter: data.manterId,
      p_remover: data.removerId,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

/**
 * Atualização cadastral da construtora
 */
export const atualizarCliente = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: {
    id: string;
    nome: string;
    cidade?: string | undefined;
    uf?: string | undefined;
    cnpj?: string | undefined;
    observacoes?: string | undefined;
    situacaoPrado: SituacaoPrado;
    representantePrado?: string | undefined;
  }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    const { error } = await supabase
      .from('clientes')
      .update({
        nome: data.nome.trim(),
        cidade: data.cidade?.trim() || null,
        uf: data.uf?.trim()?.toUpperCase() || null,
        cnpj: data.cnpj?.trim() || null,
        observacoes: data.observacoes?.trim() || null,
        situacao_prado: data.situacaoPrado,
        representante_prado: data.situacaoPrado === 'atendida_outro_rep' ? data.representantePrado?.trim() || null : null,
      })
      .eq('id', data.id);

    if (error) throw new Error(error.message);
    return { success: true };
  });

/**
 * Adicionar contato à construtora existente
 */
export const adicionarContato = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: {
    clienteId: string;
    nome: string;
    cargo?: string | undefined;
    telefone?: string | undefined;
    whatsapp?: string | undefined;
    email?: string | undefined;
    observacoes?: string | undefined;
  }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    const { data: contato, error } = await supabase
      .from('contatos')
      .insert({
        cliente_id: data.clienteId,
        nome: data.nome.trim(),
        cargo: data.cargo?.trim() || null,
        telefone: data.telefone?.trim() || null,
        whatsapp: data.whatsapp?.trim() || null,
        email: data.email?.trim() || null,
        observacoes: data.observacoes?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Este WhatsApp ou e-mail já pertence a outro contato cadastrado.');
      }
      throw new Error(error.message);
    }

    return { success: true, contato };
  });

/**
 * Edição de contato existente
 */
export const editarContato = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: {
    id: string;
    nome: string;
    cargo?: string | undefined;
    telefone?: string | undefined;
    whatsapp?: string | undefined;
    email?: string | undefined;
    observacoes?: string | undefined;
  }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    if (!data.nome?.trim()) throw new Error('Informe o nome do contato.');

    const { data: contato, error } = await supabase
      .from('contatos')
      .update({
        nome: data.nome.trim(),
        cargo: data.cargo?.trim() || null,
        telefone: data.telefone?.trim() || null,
        whatsapp: data.whatsapp?.trim() || null,
        email: data.email?.trim() || null,
        observacoes: data.observacoes?.trim() || null,
      })
      .eq('id', data.id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Este WhatsApp ou e-mail já pertence a outro contato cadastrado.');
      }
      throw new Error(error.message);
    }

    return { success: true, contato };
  });

/**
 * RPC obter_ou_criar_marca
 */
export const obterOuCriarMarca = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: { nome: string }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    const nome = data.nome?.trim();
    if (!nome) throw new Error('Informe o nome da marca.');

    const { data: id, error } = await supabase.rpc('obter_ou_criar_marca', {
      p_nome: nome,
    });
    if (error) throw new Error(error.message);

    const { data: marca, error: errMarca } = await supabase
      .from('marcas')
      .select('*')
      .eq('id', id)
      .single();
    if (errMarca) throw new Error(errMarca.message);

    return { id, marca };
  });

/**
 * RPC registrar_atividade
 */
export const registrarAtividade = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: {
    tipo: TipoRegistro;
    texto: string;
    clienteId?: string | undefined;
    contatoId?: string | undefined;
    oportunidadeId?: string | undefined;
    dataProxima?: string | undefined;
    motivo?: string | undefined;
  }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    if (!data.texto?.trim()) throw new Error('Descreva a atividade.');

    const { error } = await supabase.rpc('registrar_atividade', {
      p_tipo: data.tipo,
      p_texto: data.texto.trim(),
      ...(data.clienteId ? { p_cliente_id: data.clienteId } : {}),
      ...(data.contatoId ? { p_contato_id: data.contatoId } : {}),
      ...(data.oportunidadeId ? { p_oportunidade_id: data.oportunidadeId } : {}),
      ...(data.dataProxima ? { p_data_proxima: data.dataProxima } : {}),
      ...(data.motivo?.trim() ? { p_motivo: data.motivo.trim() } : {}),
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

/**
 * Edição de oportunidade existente na ficha da construtora
 */
export const editarOportunidade = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: {
    clienteId: string;
    oportunidadeId: string;
    marcaIds: string[];
    descricao?: string | null | undefined;
    contatoId?: string | null | undefined;
  }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    if (!data.clienteId) throw new Error('ID da construtora não informado.');
    if (!data.oportunidadeId) throw new Error('ID da oportunidade não informado.');
    if (!data.marcaIds || data.marcaIds.length === 0) {
      throw new Error('Selecione pelo menos uma marca.');
    }

    // 1. Checa se a oportunidade pertence ao cliente informado
    const { data: opExistente, error: opErr } = await supabase
      .from('oportunidades')
      .select('*')
      .eq('id', data.oportunidadeId)
      .single();

    if (opErr || !opExistente) throw new Error('Oportunidade não encontrada.');
    if (opExistente.cliente_id !== data.clienteId) {
      throw new Error('A oportunidade não pertence a esta construtora.');
    }

    // 2. Se contato informado, checa se pertence a esse cliente
    if (data.contatoId) {
      const { data: contatoExistente, error: contErr } = await supabase
        .from('contatos')
        .select('id, cliente_id')
        .eq('id', data.contatoId)
        .single();

      if (contErr || !contatoExistente) throw new Error('Contato não encontrado.');
      if (contatoExistente.cliente_id !== data.clienteId) {
        throw new Error('O contato selecionado não pertence a esta construtora.');
      }
    }

    // 3. Atualizar oportunidade
    const { data: opAtualizada, error: updErr } = await supabase
      .from('oportunidades')
      .update({
        marca_ids: data.marcaIds,
        descricao: data.descricao?.trim() || null,
        contato_id: data.contatoId || null,
      })
      .eq('id', data.oportunidadeId)
      .select()
      .single();

    if (updErr) throw new Error(updErr.message);

    // 4. Se as marcas mudaram, gravar registro tipo 'nota' no histórico:
    // "Marcas alteradas: <antes> → <depois>"
    const antesIds = [...(opExistente.marca_ids || [])].sort();
    const depoisIds = [...data.marcaIds].sort();
    const marcasMudaram = JSON.stringify(antesIds) !== JSON.stringify(depoisIds);

    if (marcasMudaram) {
      const todosIds = Array.from(new Set([...antesIds, ...depoisIds]));
      const { data: marcasData } = await supabase
        .from('marcas')
        .select('id, nome')
        .in('id', todosIds);

      const marcasMap = new Map((marcasData || []).map((m: any) => [m.id, m.nome]));
      const nomesAntes = (opExistente.marca_ids || []).map((id: string) => marcasMap.get(id) || id).join(', ') || 'Nenhuma';
      const nomesDepois = data.marcaIds.map((id: string) => marcasMap.get(id) || id).join(', ') || 'Nenhuma';

      await supabase.from('registros').insert({
        cliente_id: data.clienteId,
        oportunidade_id: data.oportunidadeId,
        contato_id: data.contatoId || null,
        tipo: 'nota',
        direcao: 'nenhuma',
        texto: `Marcas alteradas: ${nomesAntes} → ${nomesDepois}`,
      });
    }

    return { success: true, oportunidade: opAtualizada };
  });

/**
 * Criação de nova oportunidade em construtora existente
 */
export const criarOportunidade = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: {
    clienteId: string;
    marcaIds: string[];
    descricao?: string | null | undefined;
    contatoId?: string | null | undefined;
  }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertAuthorized(supabase);

    if (!data.clienteId) throw new Error('ID da construtora não informado.');
    if (!data.marcaIds || data.marcaIds.length === 0) {
      throw new Error('Selecione pelo menos uma marca.');
    }

    // 1. Checa se o cliente existe
    const { data: cliente, error: cliErr } = await supabase
      .from('clientes')
      .select('id')
      .eq('id', data.clienteId)
      .single();

    if (cliErr || !cliente) throw new Error('Construtora não encontrada.');

    // 2. Se contato informado, checa se pertence a este cliente
    if (data.contatoId) {
      const { data: contato, error: contErr } = await supabase
        .from('contatos')
        .select('id, cliente_id')
        .eq('id', data.contatoId)
        .single();

      if (contErr || !contato) throw new Error('Contato não encontrado.');
      if (contato.cliente_id !== data.clienteId) {
        throw new Error('O contato selecionado não pertence a esta construtora.');
      }
    }

    // 3. Inserir oportunidade com etapa inicial 'prospeccao'
    const { data: novaOp, error: insErr } = await supabase
      .from('oportunidades')
      .insert({
        cliente_id: data.clienteId,
        contato_id: data.contatoId || null,
        marca_ids: data.marcaIds,
        descricao: data.descricao?.trim() || null,
        etapa: 'prospeccao',
      })
      .select()
      .single();

    if (insErr || !novaOp) throw new Error(insErr?.message || 'Erro ao criar oportunidade.');

    // 4. Gravar registro tipo 'nota': "Nova oportunidade: <marcas>"
    const { data: marcasData } = await supabase
      .from('marcas')
      .select('id, nome')
      .in('id', data.marcaIds);

    const marcasMap = new Map((marcasData || []).map((m: any) => [m.id, m.nome]));
    const nomesMarcas = data.marcaIds.map((id: string) => marcasMap.get(id) || id).join(', ') || 'Nenhuma';

    await supabase.from('registros').insert({
      cliente_id: data.clienteId,
      oportunidade_id: novaOp.id,
      contato_id: data.contatoId || null,
      tipo: 'nota',
      direcao: 'nenhuma',
      texto: `Nova oportunidade: ${nomesMarcas}`,
    });

    return { success: true, oportunidade: novaOp };
  });

