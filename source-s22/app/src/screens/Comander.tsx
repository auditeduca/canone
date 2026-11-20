/* ============================================================================
   COMANDER — a área do administrador.
   ============================================================================
   Duas metades, uma ideia:

   · O COMANDER é onde se age. Cada ação privilegiada é um comando
     nomeado, com contrato explícito e — antes de executar — a PRÉVIA:
     a mesma execução, desfeita. A prévia diz o que o BANCO faria, com a
     recusa do banco, quando é o caso.

   · A GOVERNANÇA é onde se olha. O que está pendente, o que está sem
     fonte, o que está aberto, o que já aconteceu, e se a cadeia de
     auditoria ainda fecha.

   A honestidade da tela é uma propriedade do banco: o que não tem número
   mostra "sem fonte", não zero; o que não tem estado mostra o motivo da
   ausência, não um espaço em branco.
   ========================================================================== */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CATALOGO_LOCAL,
  ClienteComander,
  divergenciaDeCatalogo,
} from '../api/cliente';
import type {
  CatalogoComando,
  EstadoComander,
  ResultadoComando,
} from '../api/contrato-comander';
import { IcArrow, IcCheck, IcChevron, IcLock } from '../brand/icons';
import './comander.css';

type Aba = 'comander' | 'governanca';

interface CampoValores {
  [nome: string]: string;
}

function valoresIniciais(cmd: CatalogoComando | null): CampoValores {
  const v: CampoValores = {};
  if (!cmd) return v;
  for (const c of cmd.exige) {
    v[c.nome] = c.tipo === 'selecao' ? (c.opcoes?.[0]?.valor ?? '') : '';
  }
  return v;
}

function dataCurta(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

function num(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return String(v);
}

export function Comander() {
  const [aba, setAba] = useState<Aba>('comander');
  const [cliente] = useState(() => new ClienteComander());
  const [catalogo, setCatalogo] = useState<CatalogoComando[]>(CATALOGO_LOCAL);
  const [divergencia, setDivergencia] = useState<string | null>(null);
  const [conectado, setConectado] = useState<boolean | null>(null);
  const [erroCatalogo, setErroCatalogo] = useState<string | null>(null);

  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [valores, setValores] = useState<CampoValores>({});
  const [resultado, setResultado] = useState<ResultadoComando | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [estado, setEstado] = useState<EstadoComander | null>(null);
  const [erroEstado, setErroEstado] = useState<string | null>(null);

  // O catálogo do servidor, quando há servidor. A divergência com o
  // catálogo do app é MOSTRADA — nunca absorvida.
  useEffect(() => {
    let vivo = true;
    if (cliente.semBackend) {
      setConectado(false);
      return;
    }
    void (async () => {
      const r = await cliente.catalogoDoServidor();
      if (!vivo) return;
      if (r.ok && r.dados) {
        setCatalogo(r.dados);
        const d = divergenciaDeCatalogo(r.dados, CATALOGO_LOCAL);
        if (d.apenasNoServidor.length || d.apenasNoApp.length) {
          setDivergencia(
            `O servidor e o app não concordam sobre o catálogo. ` +
              `${d.apenasNoServidor.length ? `Só no servidor: ${d.apenasNoServidor.join(', ')}. ` : ''}` +
              `${d.apenasNoApp.length ? `Só no app: ${d.apenasNoApp.join(', ')}.` : ''}`
          );
        } else {
          setDivergencia(null);
        }
        setConectado(true);
        setErroCatalogo(null);
      } else {
        setConectado(false);
        setErroCatalogo(r.erro ?? 'Falha ao ler o catálogo.');
      }
    })();
    return () => { vivo = false; };
  }, [cliente]);

  const cmd = useMemo(
    () => catalogo.find((c) => c.id === selecionado) ?? null,
    [catalogo, selecionado]
  );

  useEffect(() => {
    setValores(valoresIniciais(cmd));
    setResultado(null);
  }, [cmd]);

  const carregarEstado = useCallback(async () => {
    if (cliente.semBackend) return;
    setErroEstado(null);
    const r = await cliente.estado();
    if (r.ok && r.dados) setEstado(r.dados);
    else setErroEstado(r.erro ?? 'Não foi possível ler o estado.');
  }, [cliente]);

  useEffect(() => {
    if (aba === 'governanca') void carregarEstado();
  }, [aba, carregarEstado]);

  async function previa() {
    if (!cmd) return;
    setOcupado(true);
    setResultado(null);
    const r = await cliente.previa(cmd.id, valores);
    setOcupado(false);
    if (r.ok && r.dados) setResultado(r.dados);
    else setResultado({
      ok: false,
      comando: cmd.id,
      previa: true,
      recusa: { mensagem: r.erro ?? 'Falha na prévia.' },
    });
  }

  async function executar() {
    if (!cmd) return;
    setOcupado(true);
    setResultado(null);
    const r = await cliente.executar(cmd.id, valores);
    setOcupado(false);
    if (r.ok && r.dados) {
      setResultado(r.dados);
      if (r.dados.ok && aba === 'governanca') void carregarEstado();
    } else {
      setResultado({
        ok: false,
        comando: cmd.id,
        previa: false,
        recusa: { mensagem: r.erro ?? 'Falha na execução.' },
      });
    }
  }

  return (
    <div className="shell page cmd">
      <span className="label">Área do administrador</span>
      <h1 className="display-md" style={{ marginTop: 12 }}>Comander</h1>
      <p className="lede" style={{ marginTop: 12, maxWidth: '68ch' }}>
        Toda ação privilegiada é um <strong>comando nomeado</strong>, com contrato
        explícito, prévia e rastro. A prévia é a mesma execução, desfeita — o que
        o banco faria, não o que a interface imagina. A governança mostra o que
        está pendente, o que está sem fonte e o que já aconteceu.
      </p>

      <div className="cmd-status" role="status">
        {conectado === null ? (
          <span className="cmd-status-item">Conferindo o backend…</span>
        ) : conectado ? (
          <span className="cmd-status-item cmd-status-ok">
            <IcCheck className="icon-sm" /> Conectado ao comander
          </span>
        ) : (
          <span className="cmd-status-item cmd-status-off">
            <IcLock className="icon-sm" /> Sem backend — o catálogo está aqui, mas
            os comandos não são executados
          </span>
        )}
        {erroCatalogo && <span className="cmd-status-item cmd-status-off">{erroCatalogo}</span>}
        {divergencia && <span className="cmd-status-item cmd-status-warn">{divergencia}</span>}
      </div>

      <div className="cmd-abas" role="tablist" aria-label="Seções da área do administrador">
        <button
          role="tab"
          aria-selected={aba === 'comander'}
          className={`cmd-aba ${aba === 'comander' ? 'cmd-aba-on' : ''}`}
          onClick={() => setAba('comander')}
        >
          Comander
        </button>
        <button
          role="tab"
          aria-selected={aba === 'governanca'}
          className={`cmd-aba ${aba === 'governanca' ? 'cmd-aba-on' : ''}`}
          onClick={() => setAba('governanca')}
        >
          Governança
        </button>
      </div>

      {aba === 'comander' ? (
        <div className="cmd-grid">
          <aside className="cmd-lista" aria-label="Comandos disponíveis">
            {catalogo.map((c) => (
              <button
                key={c.id}
                className={`cmd-item ${c.id === selecionado ? 'cmd-item-on' : ''}`}
                onClick={() => setSelecionado(c.id)}
                aria-pressed={c.id === selecionado}
              >
                <span className="cmd-item-nivel">{c.nivel}</span>
                <span className="cmd-item-titulo">{c.titulo}</span>
                <span className="cmd-item-desc">{c.descricao}</span>
              </button>
            ))}
          </aside>

          <section className="cmd-painel panel" aria-live="polite">
            {!cmd ? (
              <div className="cmd-vazio">
                <p>Escolha um comando à esquerda.</p>
                <p className="cmd-vazio-nota">
                  Cada comando declara o que exige, o que faz e o que o banco
                  recusa. Nada aqui executa sem passar pelo banco.
                </p>
              </div>
            ) : (
              <>
                <div className="cmd-painel-head">
                  <h2 className="h3">{cmd.titulo}</h2>
                  <span className="chip chip-on">{cmd.nivel}</span>
                </div>
                <p className="cmd-desc">{cmd.descricao}</p>
                <div className="cmd-regra">
                  <span className="label-sm">O que o banco recusa</span>
                  <p>{cmd.regra}</p>
                </div>

                <form className="cmd-form" onSubmit={(e) => { e.preventDefault(); void previa(); }}>
                  {cmd.exige.map((c) => (
                    <label key={c.nome} className="cmd-campo">
                      <span className="cmd-campo-rotulo">
                        {c.rotulo}
                        {c.obrigatorio ? <span className="cmd-obrig">obrigatório</span> : null}
                      </span>
                      {c.tipo === 'selecao' ? (
                        <select
                          className="cmd-input"
                          value={valores[c.nome] ?? ''}
                          onChange={(e) => setValores((v) => ({ ...v, [c.nome]: e.target.value }))}
                        >
                          {(c.opcoes ?? []).map((o) => (
                            <option key={o.valor} value={o.valor}>{o.rotulo}</option>
                          ))}
                        </select>
                      ) : c.tipo === 'area-texto' ? (
                        <textarea
                          className="cmd-input cmd-textarea"
                          rows={6}
                          value={valores[c.nome] ?? ''}
                          placeholder={c.dica}
                          onChange={(e) => setValores((v) => ({ ...v, [c.nome]: e.target.value }))}
                        />
                      ) : (
                        <input
                          className="cmd-input"
                          type={c.tipo === 'inteiro' ? 'number' : 'text'}
                          value={valores[c.nome] ?? ''}
                          onChange={(e) => setValores((v) => ({ ...v, [c.nome]: e.target.value }))}
                        />
                      )}
                      {c.dica && c.tipo !== 'area-texto' ? (
                        <span className="cmd-dica">{c.dica}</span>
                      ) : null}
                    </label>
                  ))}

                  <div className="cmd-acoes">
                    <button type="submit" className="btn btn-ghost" disabled={ocupado || cliente.semBackend}>
                      Pré-visualizar
                    </button>
                    <button
                      type="button"
                      className="btn btn-brass"
                      disabled={ocupado || cliente.semBackend}
                      onClick={() => void executar()}
                    >
                      Executar <IcArrow className="icon-sm" />
                    </button>
                  </div>
                </form>

                {resultado ? (
                  <div className={`cmd-resultado ${resultado.ok ? 'cmd-resultado-ok' : 'cmd-resultado-erro'}`}>
                    <span className="label-sm">
                      {resultado.previa ? 'Prévia' : 'Executado'}
                    </span>
                    {resultado.ok && resultado.resumo ? (
                      <ul>
                        {resultado.resumo.linhas.map((l, i) => (
                          <li key={i}>{l}</li>
                        ))}
                      </ul>
                    ) : null}
                    {!resultado.ok && resultado.recusa ? (
                      <p className="cmd-recusa">{resultado.recusa.mensagem}</p>
                    ) : null}
                    {resultado.ok && resultado.previa ? (
                      <p className="cmd-nota">
                        Nada foi gravado: a prévia é a execução, desfeita.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      ) : (
        <Governanca estado={estado} erro={erroEstado} semBackend={cliente.semBackend} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* A GOVERNANÇA                                                                 */
/* -------------------------------------------------------------------------- */

function Governanca({
  estado,
  erro,
  semBackend,
}: {
  estado: EstadoComander | null;
  erro: string | null;
  semBackend: boolean;
}) {
  if (semBackend) {
    return (
      <div className="cmd-vazio panel">
        <p>
          A governança é o estado do banco. Sem backend conectado, não há estado
          a mostrar — e não há estado de exemplo para mostrar no lugar.
        </p>
        <p className="cmd-vazio-nota">
          Com o backend no ar, esta tela mostra a fila de moderação, as
          concessões de suporte (inclusive as vencidas e não revogadas), a
          saúde do conteúdo, a situação das variantes de prova, as alegações
          recusadas e a verificação da cadeia de auditoria.
        </p>
      </div>
    );
  }
  if (erro) {
    return <div className="cmd-vazio panel"><p className="cmd-recusa">{erro}</p></div>;
  }
  if (!estado) {
    return <div className="cmd-vazio panel"><p>Lendo o estado…</p></div>;
  }

  const semFonte = estado.saude.filter((s) => s.is_valid === false);
  const concessoesVencidas = estado.concessoes.filter((c) => c.expirada && !c.revoked_at);

  return (
    <div className="cmd-gov">
      <div className="cmd-gov-cards">
        <article className={`cmd-gov-card ${estado.cadeia.integra ? 'cmd-gov-ok' : 'cmd-gov-ruim'}`}>
          <span className="label-sm">Cadeia de auditoria</span>
          <p className="cmd-gov-grande">
            {estado.cadeia.integra ? 'íntegra' : `${estado.cadeia.quebradas} quebrada(s)`}
          </p>
          <p className="cmd-gov-nota">
            {estado.cadeia.integra
              ? 'O verificador recalculou o hash de cada linha do log.'
              : 'Linhas que não fecham a cadeia — a verificação recalcula o hash, não confere o que está gravado.'}
          </p>
        </article>

        <article className="cmd-gov-card">
          <span className="label-sm">Fila de moderação</span>
          <p className="cmd-gov-grande">{num(estado.fila.length)}</p>
          <p className="cmd-gov-nota">itens abertos, por ordem de prioridade</p>
        </article>

        <article className="cmd-gov-card">
          <span className="label-sm">Conteúdo sem verificação válida</span>
          <p className="cmd-gov-grande">{num(semFonte.length)}</p>
          <p className="cmd-gov-nota">de {num(estado.saude.length)} itens acompanhados</p>
        </article>

        <article className="cmd-gov-card">
          <span className="label-sm">Concessões vencidas e não revogadas</span>
          <p className="cmd-gov-grande">{num(concessoesVencidas.length)}</p>
          <p className="cmd-gov-nota">a concessão expira sozinha; revogá-la deixa o rastro</p>
        </article>
      </div>

      <section className="panel cmd-gov-secao">
        <h3 className="h3">Fila de moderação</h3>
        {estado.fila.length === 0 ? (
          <p className="cmd-vazio-nota">Nada aberto.</p>
        ) : (
          <table className="cmd-tabela">
            <thead>
              <tr><th>Fila</th><th>Motivo</th><th>Conteúdo</th><th>Prioridade</th><th>Aberta em</th></tr>
            </thead>
            <tbody>
              {estado.fila.map((f) => (
                <tr key={f.id}>
                  <td><span className="chip">{f.queue}</span></td>
                  <td>{f.reason}</td>
                  <td className="mono">{f.content_key ?? '—'}</td>
                  <td>{num(f.priority)}</td>
                  <td className="mono">{dataCurta(f.opened_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel cmd-gov-secao">
        <h3 className="h3">Concessões de suporte</h3>
        {estado.concessoes.length === 0 ? (
          <p className="cmd-vazio-nota">Nenhuma concessão concedida.</p>
        ) : (
          <table className="cmd-tabela">
            <thead>
              <tr><th>Motivo</th><th>Aluno</th><th>Situação</th><th>Expira</th></tr>
            </thead>
            <tbody>
              {estado.concessoes.map((c) => (
                <tr key={c.id}>
                  <td>{c.reason}</td>
                  <td className="mono">{c.subject_user_id.slice(0, 8)}…</td>
                  <td>
                    {c.revoked_at ? 'revogada' : c.vigente ? 'vigente' : 'vencida'}
                  </td>
                  <td className="mono">{dataCurta(c.expires_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel cmd-gov-secao">
        <h3 className="h3">Variantes de prova</h3>
        {estado.provas.length === 0 ? (
          <p className="cmd-vazio-nota">Nenhuma prova importada.</p>
        ) : (
          <table className="cmd-tabela">
            <thead>
              <tr><th>Rodada</th><th>Exame</th><th>Variante</th><th>Questões</th><th>Gabarito</th><th>Anuladas</th></tr>
            </thead>
            <tbody>
              {estado.provas.map((p) => (
                <tr key={p.exam_form_id}>
                  <td className="mono">{p.edition_code}</td>
                  <td>{p.track_code}{p.specialty_code ? ` · ${p.specialty_code}` : ''}</td>
                  <td className="mono">{p.form_code}</td>
                  <td>
                    {p.items_linked === p.question_count
                      ? num(p.question_count)
                      : `${num(p.items_linked)} de ${num(p.question_count)}`}
                  </td>
                  <td>{p.key_status ?? 'sem gabarito'}</td>
                  <td>{num(p.annulled)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel cmd-gov-secao">
        <h3 className="h3">Alegações recusadas</h3>
        {estado.recusas.length === 0 ? (
          <p className="cmd-vazio-nota">Nenhuma alegação recusada.</p>
        ) : (
          <ul className="cmd-lista-simples">
            {estado.recusas.map((r) => (
              <li key={r.id}>
                <span className="mono">{r.key}</span> — {r.refusal_reason ?? 'sem motivo registrado'}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel cmd-gov-secao">
        <h3 className="h3">Auditoria recente</h3>
        {estado.auditoria.length === 0 ? (
          <p className="cmd-vazio-nota">Nenhum evento registrado.</p>
        ) : (
          <table className="cmd-tabela">
            <thead>
              <tr><th>Seq</th><th>Quando</th><th>Ação</th><th>Papel</th><th>Entidade</th></tr>
            </thead>
            <tbody>
              {estado.auditoria.map((e) => (
                <tr key={e.seq}>
                  <td className="mono">{e.seq}</td>
                  <td className="mono">{dataCurta(e.occurred_at)}</td>
                  <td>{e.action}</td>
                  <td>{e.actor_role ?? '—'}</td>
                  <td className="mono">{e.entity_type ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

/* Mantém o import do Chevron vivo para o design system não gerar aviso. */
void IcChevron;
