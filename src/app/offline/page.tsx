import { WifiOff } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

// Fallback do service worker (INC-012) quando a navegacao offline cai numa
// pagina nunca visitada antes (sem copia em cache para servir).
export default function OfflinePage() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-10">
      <EmptyState
        icon={WifiOff}
        title="Sem conexão"
        description="Esta tela ainda não foi salva para uso offline. Conecte-se à internet e tente novamente."
      />
    </div>
  );
}
