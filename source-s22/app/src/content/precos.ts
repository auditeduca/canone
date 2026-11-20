/* eslint-disable */
// ARQUIVO GERADO. NÃO EDITE.
//
// Fonte: commerce.plan (schema do Cânone) — o preço e a origem de cada
// plano vêm do banco. Gerado por backend/scripts/gerar-precos.mjs.
// O teste `13-preco` confere que este arquivo está em dia: preço escrito
// à mão no app mente, e o cliente descobre a mentira no checkout.

export interface PrecoPlano {
  key: string;
  nome: string;
  descricao: string | null;
  periodo: 'mensal' | 'anual' | 'semestral' | 'vitalicio';
  centavos: number;
  rotulo: string;
  /** A origem do preço, como está no banco. Sem origem, o preço não sai. */
  origem: string;
  diasDeTeste: number;
  destaque: boolean;
  recursos: { chave: string; limite: number | null; ativo: boolean }[];
}

export const PLANOS: PrecoPlano[] = [
  {
    key: "completo",
    nome: "Completo",
    descricao: "Tudo o Essencial tem, mais flashcards, plano e mapa.",
    periodo: "mensal",
    centavos: 1500,
    rotulo: "R$ 15,00/mês",
    // Fonte: "decisão do dono (13/11/2026): R$ 15,00/mês"
    origem: "decisão do dono (13/11/2026): R$ 15,00/mês",
    diasDeTeste: 7,
    destaque: false,
    recursos: [{"chave":"flashcards","limite":null,"ativo":true},{"chave":"plano_de_estudos","limite":null,"ativo":true},{"chave":"simulados_mes","limite":null,"ativo":true}],
  },
  {
    key: "anual",
    nome: "Anual",
    descricao: "O Completo, com ciclo anual.",
    periodo: "anual",
    centavos: 18000,
    rotulo: "R$ 180,00/ano",
    // Fonte: "derivado de R$ 15,00/mês × 12 meses (sem desconto inventado); a confirmar com o dono"
    origem: "derivado de R$ 15,00/mês × 12 meses (sem desconto inventado); a confirmar com o dono",
    diasDeTeste: 7,
    destaque: true,
    recursos: [{"chave":"flashcards","limite":null,"ativo":true},{"chave":"plano_de_estudos","limite":null,"ativo":true},{"chave":"simulados_mes","limite":null,"ativo":true}],
  },
];

/** O plano em destaque (o anual). O app usa este para o cartão principal. */
export const PLANO_DESTAQUE = PLANOS.find((p) => p.destaque) ?? PLANOS[0];
