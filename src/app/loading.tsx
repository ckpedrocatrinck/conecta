import { Loading } from "@/components/ui/loading";

// Q1 (auditoria de usabilidade 2026-07): sem isto, a navegacao entre rotas
// (Server Components com query no banco) deixa a tela congelada em rede
// ruim, sem nenhum feedback de carregamento.
export default function RootLoading() {
  return <Loading />;
}
