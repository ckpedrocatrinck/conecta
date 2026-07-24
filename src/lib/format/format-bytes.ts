// Tamanho de arquivo legivel em pt-BR (virgula decimal). Usado no card de
// documento do feed (INC-016). Base binaria (KiB/MiB) rotulada como KB/MB —
// convencao comum em UI de arquivos.
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${formatNumber(kb)} KB`;
  return `${formatNumber(kb / 1024)} MB`;
}

function formatNumber(value: number): string {
  // Uma casa decimal, sem ".0" redundante, com virgula (pt-BR).
  const rounded = Math.round(value * 10) / 10;
  const str = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return str.replace(".", ",");
}
