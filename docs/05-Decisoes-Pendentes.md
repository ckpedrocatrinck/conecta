# Decisões Pendentes

> Nada aqui é detalhe. Cada item ou bloqueia uma fase ou muda o desenho do produto. Resolver → registrar → promover a ADR/spec → remover daqui.

## ✅ Resolvidas em 2026-07-09

- **DP-01 — Acordo de IP com o Rede Vale Verde.** ✅ **100% aprovado pela diretoria** (produto é do Pedro; empresa é cliente-piloto). Recomendação: guardar o registro escrito dessa aprovação (e-mail/termo) junto ao projeto.
- **DP-03 — Aceite dos ADRs 001-005.** ✅ Aceitos por Pedro. Ressalva registrada no ADR-002: app nativo nas lojas é plano futuro assumido (não "talvez"), PWA é a estratégia do MVP.
- **DP-08 — Dispositivos da base.** ✅ Maioria Android, **parcela relevante de iPhone**. Consequência: risco de push no iOS elevado de marginal para material → salvaguardas adicionadas ao ADR-002 e critério de medição ao INC-012.
- **Login (contradição do kickoff).** ✅ Resolvida no **ADR-006**: login por CPF completo + senha; `cpf_hash` determinístico com pepper. "CPF parcial" eliminado do escopo.
- **Pendências de modelagem** (User desligado / AnnouncementRead). ✅ Resolvidas no **ADR-006**.

## Ainda abertas — não bloqueiam o início do desenvolvimento

**DP-02 — Nome do produto.** "Conecta" é placeholder. Impacta domínio, repo, manifest do PWA e marca. Verificar disponibilidade no INPI antes de fixar. Pode rodar INC-001 com o placeholder e renomear depois (custo baixo se decidido cedo).
**Responsável:** Pedro.

**DP-05 — Dados de custo/contrato da portal legado.** Quanto o Vale Verde paga, fidelidade, quem assinou. Define teto de preço e timing da troca. Não bloqueia dev; informa a estratégia comercial.
**Responsável:** Pedro.

**DP-06 — Prazos de retenção LGPD.** Defaults (24 meses gerais; 5 anos + margem para ciência) precisam de validação jurídica **antes da venda comercial**. Para o piloto, defaults documentados bastam com ciência da controladora.
**Responsável:** Pedro + jurídico (fase comercial).

**DP-07 — Migração do histórico da portal legado.** Importar os ~450 comunicados legados (imagens) como arquivo morto ou começar do zero? Impacta INC-013. Proposta: começar do zero + legado guardado pelo RH fora do sistema.
**Responsável:** Pedro + RH do piloto.

---

## Situação para começar a codar

Todos os bloqueios das Fases 0 e 1 estão resolvidos. Os 6 ADRs estão Aceitos.
**O projeto está liberado para `/inc 001`.**
