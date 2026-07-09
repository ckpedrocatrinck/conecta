# LGPD — Requisitos Técnicos (valem para todos os INCs)

Checklist vivo. O Claude Code deve tratar cada item como requisito não-funcional permanente; a revisão de cada INC verifica os itens tocados.

## Segurança (Art. 46)

- [ ] TLS em todo tráfego (padrão da plataforma); HSTS.
- [ ] Senhas: hash forte (argon2id ou bcrypt custo ≥ 12). Nunca log de senha.
- [ ] CPF: nunca armazenado em claro. É a credencial de login (ADR-006) → `cpf_hash` **determinístico com pepper** de aplicação (env/secret manager), permitindo busca no login sem valor em claro. Rotação de pepper documentada como procedimento de emergência. Se algum cliente exigir CPF recuperável (integração folha), campo separado cifrado (AES-GCM) — decisão nova quando surgir a demanda.
- [ ] Sessões server-side revogáveis; logout invalida de verdade.
- [ ] Rate limit em login e endpoints de escrita.
- [ ] RLS ativa por tenant (ADR-003) + teste automatizado de isolamento.
- [ ] Uploads: validação de tipo/tamanho; URLs de mídia assinadas ou com token (fotos de pessoas não podem ser públicas por URL adivinhável).
- [ ] Backups do banco cifrados; teste de restore documentado antes do go-live.
- [ ] Segredos fora do repositório (.env ignorado; .env.example versionado).

## Auditoria e logs

- [ ] `AuditLog` para ações administrativas (criou/editou/arquivou comunicado, importou colaboradores, exportou CSV, mudou papel).
- [ ] Logs de aplicação sem dados pessoais desnecessários (nunca corpo de documento, nunca CPF).
- [ ] `AnnouncementAck` imutável na aplicação (sem UPDATE/DELETE); correções = novo registro compensatório com trilha.

## Ciclo de vida do dado

- [ ] Desligamento de colaborador ⇒ `status=inactive` imediato (perde acesso), dados pessoais **anonimizados após prazo de retenção configurável por tenant** (default proposto: 24 meses), EXCETO registros de ciência, que são mantidos vinculados a um identificador pseudonimizado pelo prazo prescricional trabalhista (proposta: 5 anos + margem; confirmar com jurídico).
- [ ] Encerramento de contrato com tenant ⇒ export completo dos dados ao cliente + eliminação/anonimização em prazo contratual.
- [ ] Consentimentos (foto, aniversário visível) com registro de quando foram dados/revogados.

## Transferência internacional

- [ ] Se infra fora do Brasil (Vercel/Neon us-east), o aviso de privacidade declara a transferência e os fundamentos (Art. 33) — cláusulas contratuais do fornecedor. Preferir região São Paulo quando disponível sem custo proibitivo.

## Interface

- [ ] Aviso de privacidade acessível no primeiro login e no perfil.
- [ ] Toggles de consentimento no perfil (foto, aniversário visível) com efeito imediato.
- [ ] Tela "Meus dados" mostra o que o sistema sabe sobre o titular (dados cadastrais + minhas confirmações + minhas candidaturas).

## Pendências jurídicas (não bloqueiam desenvolvimento; bloqueiam venda)

- [ ] Template de contrato operador↔controladora.
- [ ] Validação dos prazos de retenção com advogado trabalhista/privacidade.
- [ ] RIPD (relatório de impacto) simplificado quando houver 2º cliente.
