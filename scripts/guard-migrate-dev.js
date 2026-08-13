#!/usr/bin/env node
// Trava contra `prisma migrate dev` neste projeto (INC-027 Bloco 5, DP-40).
//
// Por que existe: `announcement_versions.search_vector` e' uma coluna
// GENERATED ALWAYS AS ... STORED que o Prisma nao modela nativamente (ADR-008).
// `migrate dev` calcula diff contra uma shadow database e tenta um
// `ALTER COLUMN ... DROP DEFAULT` que o Postgres recusa nessa coluna — na
// melhor hipotese trava com erro; na pior, e' interpretado como drift e o
// Prisma oferece RESETAR o banco (apaga tudo e reexecuta o seed). Isso ja'
// aconteceu de fato neste projeto: e' a causa raiz confirmada do incidente
// "senha de demonstracao volta pro padrao a cada reinicio" (Bloco 3.11).
//
// O QUE ESTE SCRIPT COBRE: só a chamada que passa por `npm run db:migrate:dev`
// (alguem que tenta adivinhar o nome do script, por analogia a `db:seed`).
// O QUE ELE NAO COBRE (documentado, nao escondido — trava parcial e' melhor
// que trava presumida): `npx prisma migrate dev` digitado direto, ou
// `prisma migrate dev` com o Prisma instalado global, passam completamente
// por fora do package.json — nenhum script npm intercepta uma chamada que
// nunca passa por `npm run`. Isso so' seria fechavel com algo fora do escopo
// deste bloco (proxy do binario, hook de rede, etc.), com custo/risco que
// nao foi avaliado como proporcional aqui.
console.error("");
console.error("BLOQUEADO: `prisma migrate dev` e' proibido neste projeto (ADR-008).");
console.error("");
console.error("A coluna GENERATED announcement_versions.search_vector nao e' modelavel");
console.error("pelo Prisma — `migrate dev` calcula um diff espurio contra ela e pode");
console.error("disparar RESET do banco (apaga tudo, reexecuta o seed). Ja' aconteceu.");
console.error("");
console.error("Use isto em vez disso:");
console.error("  npx prisma migrate deploy   # aplica as migrations existentes");
console.error("");
console.error("Precisa CRIAR uma migration nova (tabela/coluna nova)? Siga o procedimento");
console.error("manual do ADR-008 (secao \"Decisao\", passos 1-6): gerar o SQL com");
console.error("`npx prisma migrate dev --create-only` (sem aplicar — este script nao");
console.error("intercepta essa chamada direta), editar o arquivo gerado a mao, e so' entao");
console.error("aplicar com `migrate deploy`.");
console.error("");
console.error("Ver: docs/02-Arquitetura/ADR/ADR-008-migracoes-manuais-colunas-generated.md");
console.error("");
process.exit(1);
