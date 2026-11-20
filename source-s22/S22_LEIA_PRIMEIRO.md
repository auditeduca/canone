# Cânone S22 — leia primeiro

A S22 é uma correção do backend e do ensaio SQL de uma **plataforma independente de provas para contadores**, não relacionada às Calculadoras de Enfermagem.

## Estado

- 43 referências SQL distintas em 8 fontes reconciliadas, 56 ocorrências.
- 30/30 migrations originais preservadas por SHA256.
- PostgreSQL 17.12 descartável: DDL candidato 30/30 PASS, RLS FORCE 90/90, funções privilegiadas 14/14 após endurecimento candidato.
- API HTTP + banco real: 5/5 PASS como PostgreSQL superusuário com troca de papel e 5/5 PASS no processo com login não superusuário.
- Regressões locais: 277/277 PASS; backup/restore PASS.
- Vercel: a prévia S19 existente não foi modificada.
- GitHub remoto/Supabase compartilhado: nenhuma alteração.
- **Gate global: NO-GO**. Código e SQL desta branch não estão aprovados para produção.

Leia `docs/pmo/MARCO_S22_COMPATIBILIDADE_PG17_2026-11-15.md` e os manifestos de evidência antes de qualquer próxima ordem.

## Atenção

**Nunca** execute `reviews/*.sql.txt` ou `S22_HARDENING_CANDIDATE.sql.txt` em Supabase compartilhado. O único ensaio cobriu um cluster descartável com guardas. Não transforme os testes de DDL em aprovação de segurança da plataforma comercial.
