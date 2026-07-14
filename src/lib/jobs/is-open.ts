import type { JobStatus } from "@prisma/client";

/**
 * Condicao unica de "aceita candidatura agora" (INC-011). Prazo vencido
 * fecha a vaga de forma COMPUTADA, nao via sweep/cron (diferente da
 * publicacao agendada de comunicados, que precisa transicionar de verdade
 * porque atribui seq_number) — nenhum efeito colateral depende de o status
 * fisicamente virar "closed" quando o prazo passa. Usada tanto para
 * filtrar a listagem do colaborador quanto para validar a candidatura na
 * propria server action (nunca confia so' na UI/listagem).
 */
export function isJobOpeningAcceptingApplications(
  job: { status: JobStatus; deadline: Date },
  now: Date = new Date(),
): boolean {
  return job.status === "open" && job.deadline.getTime() > now.getTime();
}
