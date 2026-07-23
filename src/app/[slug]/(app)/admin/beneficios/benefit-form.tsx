"use client";

import type { BenefitCategory } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BENEFIT_CATEGORY_LABELS, BENEFIT_CATEGORY_ORDER } from "@/lib/benefits/category-labels";

const TEXTAREA_CLASS =
  "w-full rounded-lg border-[1.5px] border-input bg-card px-3.5 py-2 text-body outline-none transition-colors placeholder:text-subtle-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary-subtle";

export type BenefitFormValues = {
  id: string;
  category: BenefitCategory;
  partnerName: string;
  title: string;
  description: string;
  location: string | null;
  contact: string | null;
  sortOrder: number;
};

/** Form unico de criacao/edicao de beneficio (o `benefit` opcional preenche os
 * defaults na edicao; ausente = criacao). Texto PLANO na descricao (sem editor
 * rico, decisao do Pedro). Sem campo de logo no MVP. */
export function BenefitForm({
  action,
  submitLabel,
  benefit,
}: {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  benefit?: BenefitFormValues;
}) {
  return (
    <form action={action} className="flex w-full max-w-xl flex-col gap-4">
      {benefit && <input type="hidden" name="id" value={benefit.id} />}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category">Categoria</Label>
        <Select id="category" name="category" required defaultValue={benefit?.category ?? ""}>
          <option value="" disabled>
            Selecione uma categoria
          </option>
          {BENEFIT_CATEGORY_ORDER.map((cat) => (
            <option key={cat} value={cat}>
              {BENEFIT_CATEGORY_LABELS[cat]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="partnerName">Parceiro</Label>
        <Input id="partnerName" name="partnerName" required defaultValue={benefit?.partnerName ?? ""} placeholder="Ex.: Academia Fit" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Benefício</Label>
        <Input id="title" name="title" required defaultValue={benefit?.title ?? ""} placeholder="Ex.: 30% de desconto na mensalidade" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Descrição / como usar</Label>
        <textarea
          id="description"
          name="description"
          rows={4}
          required
          defaultValue={benefit?.description ?? ""}
          placeholder="Detalhes, condições e como aproveitar o benefício."
          className={TEXTAREA_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="location">Local (opcional)</Label>
        <Input id="location" name="location" defaultValue={benefit?.location ?? ""} placeholder="Endereço ou como chegar" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact">Contato (opcional)</Label>
        <Input id="contact" name="contact" defaultValue={benefit?.contact ?? ""} placeholder="Telefone, site ou instrução de contato" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sortOrder">Ordem na categoria</Label>
        <Input
          id="sortOrder"
          name="sortOrder"
          type="number"
          min={0}
          step={1}
          defaultValue={benefit?.sortOrder ?? 0}
        />
        <span className="text-meta text-subtle-foreground">Menor número aparece primeiro dentro da categoria.</span>
      </div>

      <Button type="submit" size="touch" className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
