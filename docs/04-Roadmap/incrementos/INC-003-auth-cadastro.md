# INC-003 — Autenticação, papéis e cadastro

**Status:** ⬜ Não iniciado
**Fase:** 1
**Depende de:** INC-002
**ADRs relevantes:** 003, 006
**Docs:** LGPD (senha, CPF hash, aviso de privacidade)

## Objetivo
Login funcional por CPF + senha, papéis aplicados, e RH capaz de popular a base.

## Escopo
1. Auth.js credentials: login por **CPF completo** + senha (ADR-006). CPF normalizado → `cpf_hash` determinístico com pepper (env) para localizar o usuário; senha com argon2id/bcrypt; sessão server-side revogável; rate limit no login. CPF nunca em claro no banco nem em log.
2. Primeiro acesso: senha provisória definida no import → troca obrigatória → exibição do aviso de privacidade (conteúdo placeholder marcado como PENDENTE-JURÍDICO) com aceite registrado.
3. Papéis admin | manager | employee aplicados em middleware/layout (admin acessa painel; employee não).
4. CRUD de filiais e colaboradores no painel admin.
5. Import CSV de colaboradores: template documentado, validação linha a linha com relatório de erros, idempotente (reimport atualiza por matrícula).
6. Perfil "Meus dados": visualizar dados, trocar senha, foto (upload R2/S3 com URL não pública), toggles de consentimento (foto visível, aniversário visível) — efeito imediato.

## Critérios de aceite
- [ ] Fluxo completo: import CSV → primeiro login **por CPF** → troca de senha → aceite do aviso → home.
- [ ] Employee tentando rota admin recebe 403/redirect.
- [ ] Logout invalida sessão de verdade (sessão antiga não funciona).
- [ ] CPF nunca em claro no banco nem em logs; `cpf_hash` é determinístico e o pepper vem de env (não do repo).
- [ ] Toggles de consentimento persistem com timestamp.

## Registro de conclusão
_(preencher)_
