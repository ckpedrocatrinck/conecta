# Fora do Escopo do MVP (Backlog Fase 2+)

Registrado para não esquecer — e para não escopo-crescer o MVP. Nada daqui entra sem novo ciclo de especificação.

## Fase 1.5 (logo após piloto estável)

- **Anexos em comunicados** (PDF/imagem): deferido do INC-004. O RH do portal legado está acostumado a anexar imagem escaneada — avaliar no piloto se sentem falta. Exige entidade `AnnouncementAttachment` + storage (reusa a abstração do R2 do INC-003).
- **Ouvidoria anônima**: canal com protocolo de acompanhamento (o portal legado tem; é sensível — anonimato real exige cuidado técnico e de processo; especificar direito antes).
- **Benefícios/parceiros**: catálogo simples (categoria → parceiro → página com desconto, endereço, contato). Baixa complexidade, mas baixa dor também.
- **Enquetes** com resultados para o RH.

## Fase 2 (pós-validação comercial)

- **Assistência por IA no painel** (ADR-004): formatar rascunho em comunicado padrão, gerar resumo, gerar quiz de ciência a partir do comunicado. Upsell de plano.
- **Quiz de ciência** para comunicados críticos (evolução do "declaro que li": 2-3 perguntas, prova de compreensão).
- **LMS leve** (sucessor do LMS legado): trilhas, certificados PDF, prazo de reciclagem. Só se clientes pedirem — é produto quase à parte.
- **Permissões granulares** (gestor por equipe, não só filial; múltiplos papéis).
- **Checklist operacional** (o portal legado tem a tela, vazia; investigar se alguém sente falta antes de construir).
- **Ofertas da loja para colaboradores**.
- **Integrações**: folha/ERP para sincronizar colaboradores (admissão/desligamento automáticos), WhatsApp para notificação crítica.
- **App nativo** (só se push do PWA no iOS se provar insuficiente para a base real — medir no piloto; base do piloto é majoritariamente Android).
- **Marcos de tempo de casa automáticos** (forte candidato): análogo empresarial do aniversário do INC-010 — "Hoje o João completa 10 anos de Rede Vale Verde!" aparece sozinho, calculado a partir do `hired_at` já no cadastro. Zero manutenção do RH, conteúdo emocional, reusa o template "tempo de casa" do INC-009. Mesmo mecanismo de query do INC-010, só sobre a data de contratação em vez da de nascimento. Respeitar um opt-out análogo ao `birthday_visible`. É a versão SAUDÁVEL da ideia de "homenagear dedicação" — sobre gente ATIVA, sem os riscos abaixo.
- **História da empresa / homenagens curadas pelo RH** (editorial, não automático): seção "Nossa história" com fotos da primeira loja, marcos coletivos, momentos da empresa — curada pelo RH, sobre o Vale Verde, não uma galeria automática de indivíduos. Homenagem a uma figura histórica específica (ex.: fundador) cabe como post editorial pontual no feed já existente, com consentimento da pessoa. Risco de LGPD ~zero (é sobre a empresa/conteúdo curado, não exibição sistemática de dado de terceiros).

## Ideias avaliadas e DESCARTADAS (registrar o "não" também é decisão)

- **Galeria de "lembranças" de ex-funcionários ilustres** — DESCARTADA. Ideia: homenagear gerentes/pessoas que fizeram história e saíram. Descartada por três motivos: (1) não fortalece o núcleo jurídico nem o engajamento de quem está ATIVO — homenageia quem não está mais lá; (2) abre disputa de ego (quem entra na galeria? quem fica de fora? e quem saiu brigado/por justa causa/processando a empresa?); (3) colide de frente com o ADR-006, que ANONIMIZA dados de desligados após retenção — uma galeria manteria e exibiria dado de ex-funcionários publicamente, o oposto do que a arquitetura foi desenhada para fazer, e sem base legal clara (LGPD). A intenção emocional boa por trás dela está atendida pelos dois itens acima (marcos de tempo de casa + história curada), que capturam "reconhecer dedicação e trajetória" sem os riscos.

## Deliberadamente nunca (revisitar só com forte evidência)

- Chat 1:1 entre colaboradores (vira WhatsApp pior; risco de moderação).
- Feed aberto com postagem livre por colaborador (custo de moderação para o RH).
- Rede social gamificada com pontos/moedas.
