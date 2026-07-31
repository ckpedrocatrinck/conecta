# INC-021 — Contato do candidato (telefone + WhatsApp) na lista de vaga

**Status:** ✅ Concluído
**Fase:** 2 — Vagas / engajamento operacional
**Depende de:** INC-011 (vagas + lista de candidatos + CSV), INC-003/006 (cadastro de colaborador com `phone`)
**Branch:** `inc-021-contato-candidato-vaga`

## Objetivo

Trazer o contato do candidato para dentro do sistema, fechando o "organizam por fora pelo WhatsApp". Hoje a lista de candidatos de uma vaga mostra nome, matrícula, filial, data e observação — mas não o telefone, apesar de o dado já existir. Este INC exibe o **telefone** do candidato na lista e no CSV, com um **link `wa.me`** que abre a conversa em 1 toque, sem o dado sair do sistema.

## Contexto (mapa read-only confirmado 2026-07-31)

O grosso já existe — este INC é pequeno de propósito:
- `User.phone` (e `email`) já existem no schema (`schema.prisma:187-188`), já são coletados nos forms de criação (`colaboradores/novo`) e edição (`colaboradores/[id]`), e `phone` **já entra na anonimização** (`user.repository.ts:218-233`, zerado no desligamento). Nada disso muda.
- O candidato na lista **é um `User` via FK** — `findApplicantsForJobOpening` (`job-opening.repository.ts:123-129`) já faz `include: { user: { select: { fullName, registrationCode, branchId } } }`. O telefone está na mesma tabela já joinada; falta só selecioná-lo e propagá-lo.
- `job_application` **não** ganha coluna. Nenhuma migration, nenhum GRANT novo (`users` já tem SELECT; o dado só é lido). `grants-matrix` EXPECTED não muda.

## Decisão de PII (consciente, registrada)

O telefone é PII e será exibido a qualquer **admin** que vê a lista de candidatos, e incluído no **CSV exportável**. Isto é uma escolha deliberada, não omissão: a lista e o export são a ferramenta de trabalho do RH para conduzir o processo seletivo, e o contato do candidato é o dado central desse trabalho. O acesso já é restrito a admin (a tela e o export exigem `requireAdmin`). O ponto que este INC **protege** é o oposto: o link `wa.me` mantém o contato acontecendo a partir do sistema, em vez de o telefone ser copiado para uma planilha/grupo externo. (Se no futuro se quiser mascarar telefone para papéis não-RH, é decisão à parte — hoje só admin vê.)

## Escopo

1. **Repositório** — `job-opening.repository.ts` (`findApplicantsForJobOpening`, ~linha 127): adicionar `phone: true` ao `select` do `include.user`. Nada mais no join.
2. **Tipos/view** — `build-job-opening-view.ts`: acrescentar `phone` a `ApplicantRow` (~29-34) e `ApplicantView` (~36-43), e propagá-lo em `toApplicantView` (~48-57). Telefone pode ser `null` (campo opcional) — a view carrega `string | null`.
3. **Lista (tela)** — `vagas/[id]/page.tsx` (cards de candidato, ~96-113): exibir o telefone quando houver, com um link `wa.me`. Regras:
   - **Sem telefone** (`null`/vazio): mostrar algo discreto tipo "sem telefone cadastrado" — não um link quebrado, não sumir com a informação de que falta o dado.
   - **Com telefone**: link `https://wa.me/<numero>` que abre em nova aba. Normalizar o número para o formato que o `wa.me` espera (só dígitos, com DDI). Como o telefone é texto livre digitado no cadastro (pode vir "（22）99999-9999", "22 99999 9999", etc.), aplicar uma normalização defensiva: remover tudo que não é dígito e, se não começar com `55` (Brasil) e tiver 10-11 dígitos, prefixar `55`. Se após normalizar o número for claramente inválido (menos de 10 dígitos), mostrar o telefone como texto **sem** virar link `wa.me`, em vez de gerar um link que leva a lugar nenhum.
4. **CSV** — `job-application-export.ts` (~46-54): acrescentar a coluna "Telefone" (o número como está cadastrado, texto; não precisa normalizar no CSV — ali é registro, não link). Posição sugerida: após "Filial".

## Fora de escopo (não tocar)

- **Cadastro de colaborador** (schema, forms de criação/edição, anonimização) — já implementado e funcionando. Se o INC mexer aqui, saiu do escopo.
- **Status por candidato** (contatado/entrevistado/aprovado) — decisão **adiada**, não esquecida. Seria coluna nova em `job_applications` + GRANT UPDATE + entrada no `grants-matrix` EXPECTED + UI de estado, e é o primeiro passo de um mini-ATS. Vira INC própria se o uso da lista com contato revelar a necessidade.
- Mascarar/restringir telefone para papéis não-admin (hoje só admin vê a lista).
- INC-018/019/020 (já na main), R2, DP-24/DP-25, os 4 arquivos untracked.

## Critérios de aceite

- [x] Lista de candidatos mostra o telefone de quem tem; para quem não tem, um rótulo discreto de "sem telefone", não um link quebrado. — `vagas/[id]/page.tsx`, componente `ApplicantPhoneContact`.
- [x] Link `wa.me` abre a conversa com o número normalizado (só dígitos + DDI 55 quando aplicável); número inválido/curto vira texto puro, não link morto. — `src/lib/jobs/whatsapp-contact.ts` (`normalizeWhatsappNumber`).
- [x] CSV inclui a coluna "Telefone". — `job-application-export.ts`, coluna inserida após "Filial".
- [x] Nenhuma migration, nenhum GRANT novo, `grants-matrix` EXPECTED inalterado (confirmar verde sem tocar). — suíte completa (317 testes, incluindo `grants-matrix.test.ts`) verde sem tocar no arquivo.
- [x] Teste: a view (`toApplicantView`/`findApplicantsForJobOpening`) devolve `phone`; a normalização de número para `wa.me` tem teste unitário cobrindo os casos (número formatado com máscara → só dígitos + 55; já com 55 → não duplica; número curto/inválido → sinaliza "sem link"). Este é o único pedaço com lógica de verdade (a normalização); o resto é propagação de campo. — `whatsapp-contact.test.ts` (3 casos) + `job-openings.test.ts` (describe "candidatos trazem o telefone via join com User").
- [x] `npm run lint && npm run typecheck && npm run test && npm run build` verdes.

## Reconciliação de vault (parte da entrega)

- Escrever `docs/04-Roadmap/incrementos/INC-021-contato-candidato-vaga.md` no padrão dos outros INCs, com Registro de Conclusão.
- `docs/04-Roadmap/roadmap.md`: marcar INC-021 ✅.
- (Não há DP nova a registrar; status-por-candidato fica no backlog, não como DP.)

## Verificação manual (dev local)

Abrir uma vaga com candidatos: candidato com telefone cadastrado → aparece o número e o toque WhatsApp abre a conversa; candidato sem telefone → rótulo discreto, sem link; exportar CSV → coluna Telefone presente.

## Registro de conclusão

**Data:** 2026-07-31
**Branch:** `inc-021-contato-candidato-vaga`

O escopo confirmou exatamente o mapa read-only prévio: nenhuma migration, nenhum
GRANT, nenhum toque em cadastro/anonimização. As mudanças foram:

1. `job-opening.repository.ts` — `findApplicantsForJobOpening`: `phone: true`
   adicionado ao `select` do `include.user`.
2. `build-job-opening-view.ts` — `phone: string | null` propagado em
   `ApplicantRow` e `ApplicantView`, passado adiante em `toApplicantView`.
3. `src/lib/jobs/whatsapp-contact.ts` (novo) — `normalizeWhatsappNumber(phone)`:
   único pedaço de lógica de verdade do INC. Remove tudo que não é dígito;
   prefixa `55` se o número (10-11 dígitos) ainda não começar com `55`; abaixo
   de 10 dígitos (antes do prefixo) devolve `waLink: null` em vez de gerar link
   morto. Coberto por 3 testes unitários (`whatsapp-contact.test.ts`).
4. `vagas/[id]/page.tsx` — componente `ApplicantPhoneContact`: sem telefone →
   "Sem telefone cadastrado"; com telefone e número válido → link `wa.me` (nova
   aba); com telefone mas número curto/inválido → texto puro, sem link.
5. `job-application-export.ts` — coluna "Telefone" adicionada ao CSV, logo após
   "Filial", com o valor exatamente como cadastrado (sem normalizar — é
   registro, não link, conforme o INC pediu).

Testes de integração: cobertura nova em `tests/integration/job-openings.test.ts`
— um teste dedicado provando que `findApplicantsForJobOpening` +
`toApplicantView` devolvem `phone` (inclusive `null` para quem não tem), e o
teste de export de CSV existente ganhou asserção da coluna "Telefone" e do
valor com máscara.

**Suíte:** 313 → 317 testes (59 → 60 arquivos: `whatsapp-contact.test.ts` novo),
todos verdes. `npm run build` verde (Next.js 16.2.10 / Turbopack).

Nenhuma dívida nova criada. Status-por-candidato (contatado/entrevistado/
aprovado) segue fora de escopo, no backlog, como já registrado acima — não
virou DP porque o próprio INC já deixa isso explícito.
