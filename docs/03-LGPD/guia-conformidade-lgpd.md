# Guia de Conformidade LGPD — [NOME DO PRODUTO]

> Mapa do que é preciso para operar em conformidade. Separa o que JÁ EXISTE
> (implementado), o que FALTA (código/operação) e o que EXIGE ADVOGADO (não dá
> para resolver com template). NÃO é aconselhamento jurídico.

## 1. Controles técnicos — JÁ IMPLEMENTADOS (ao longo dos INCs)
Confirmados pela auditoria de conformidade (Bloco A do INC-013):
- Conexão cifrada (HTTPS) + headers de segurança (HSTS, CSP) — INC-013 Bloco B.
- Senha em hash forte (bcrypt); CPF em hash determinístico + pepper, nunca em
  claro — ADR-006.
- Isolamento entre empresas (RLS por tenant, testado) — ADR-003, INC-014.
- Registros de ciência invioláveis (triggers de imutabilidade) — INC-002/012.5.
- Log de ações administrativas (AuditLog) sem dados pessoais — INC-007.
- Sessão revogável; logout e desligamento invalidam acesso — ADR-007.
- Consentimento de foto/aniversário com efeito imediato — INC-003/008.
- Anonimização de desligados após retenção — INC-013 G1 (validado).
- Rate limit e proteção contra enumeração — INC-013 Bloco B (G5).
- Mídia (fotos) servida só com sessão + token assinado, nunca URL pública.

## 2. FALTA fazer (código/operação — no teu controle)
- **Aviso de privacidade definitivo** no sistema: substituir o placeholder pelo
  texto revisado (ver aviso-privacidade.md) e subir a versão. (G2)
- **Teste de restore de backup** documentado, antes do go-live. (G3)
- **Confirmar região da infra** (Brasil vs. fora) — decide se o aviso declara
  transferência internacional (Art. 33). (M3)
- (🔵 opcional) Tela "Meus dados" com histórico de ciência do titular. (G10)
- (Futuro) Purga física da foto no storage R2 junto da anonimização.
- (Futuro) Fase 2 da retenção (corte após 5 anos) — depende de definição jurídica.

## 3. EXIGE ADVOGADO (não resolver com template)
Estes protegem VOCÊ juridicamente e são necessários para vender com segurança:
- **Aviso de privacidade — revisão** do texto interino (aviso-privacidade.md).
- **Contrato de Operador de Dados** (você-operador ↔ empresa-cliente-controladora).
  CRÍTICO: define responsabilidades num vazamento. Um contrato mal-feito te
  expõe a responsabilidade solidária. NÃO usar template genérico para isto.
- **Termos de Uso** do serviço (empresa-cliente).
- **Definição do DPO/Encarregado** — quem é o contato de dados (pode ser você no
  início) e como é divulgado.
- **Validação dos prazos de retenção** (24 meses / 5 anos são propostas).
- (Com escala/2º cliente) **RIPD** — relatório de impacto simplificado.

## 4. Prioridade para o piloto
Bloqueiam o go-live: aviso definitivo (revisado), teste de restore, região
confirmada. O contrato de operador é imprescindível para a RELAÇÃO com o
Vale Verde — idealmente assinado antes de dados reais entrarem, mas é negócio+
jurídico, não código.

## 5. Caminho sem advogado agora (realista)
Se não há acesso a advogado imediato:
1. Usar o aviso interino (aviso-privacidade.md) no sistema, marcado como minuta.
2. Buscar revisão jurídica antes do go-live real (pode ser um advogado por hora,
   ou serviço de LGPD para PMEs — o material já está pronto, é rápido revisar).
3. Para o contrato de operador com o Vale Verde: como é o piloto (relação de
   confiança, você trabalha lá), pode começar com um acordo simples por escrito,
   mas formalizar o contrato de operador é fortemente recomendado antes de escalar.

> LEMBRETE: este guia organiza o caminho; não é aconselhamento jurídico. As peças
> da seção 3 devem passar por um profissional antes do produto operar com dados
> reais em escala comercial.
