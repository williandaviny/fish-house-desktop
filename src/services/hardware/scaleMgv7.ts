import { Product, TaraBalanca } from '../../types/database';

export class ScaleMgv7Service {
  /**
   * Gera o conteúdo do arquivo ITENS.TXT para a balança Toledo MGV 7
   */
  public static generateItensTxt(products: Product[]): string {
    const lines: string[] = [];
    const scaleProducts = products.filter(p => p.plu_codigo && p.is_available);

    for (const p of scaleProducts) {
      const depto = '01';
      const tipo = p.unit.toLowerCase() === 'un' || p.unit.toLowerCase() === 'und' ? '1' : '0';
      const codigo = (p.plu_codigo || '').padStart(6, '0');
      const precoCentavos = Math.round(Number(p.price) * 100).toString().padStart(6, '0');
      const validade = (p.validade_dias || 0).toString().padStart(3, '0');
      const descricao1 = p.name.substring(0, 25).padEnd(25, ' ');
      const descricao2 = (p.name.length > 25 ? p.name.substring(25, 50) : '').padEnd(25, ' ');
      const taraCodigo = '0000'; // Código de tara padrão se houver

      // Formato padrão Toledo MGV 7:
      // DD T CCCCCCC PPPPPP VVV DDDDDDDDDDDDDDDDDDDDDDDDD DDDDDDDDDDDDDDDDDDDDDDDDD TTTT
      const line = `${depto}${tipo}${codigo}${precoCentavos}${validade}${descricao1}${descricao2}${taraCodigo}`;
      lines.push(line);
    }

    return lines.join('\r\n');
  }

  /**
   * Gera o conteúdo do arquivo TARA.TXT
   */
  public static generateTaraTxt(taras: TaraBalanca[]): string {
    const lines: string[] = [];
    for (const t of taras) {
      const codigo = t.codigo.toString().padStart(4, '0');
      const pesoGrams = Math.round(Number(t.peso) * 1000).toString().padStart(5, '0');
      const desc = t.descricao.substring(0, 20).padEnd(20, ' ');
      lines.push(`${codigo}${pesoGrams}${desc}`);
    }
    return lines.join('\r\n');
  }

  /**
   * Gera o conteúdo do arquivo DEPTO.TXT
   */
  public static generateDeptoTxt(): string {
    return '01PEIXARIA E FRUTOS DO MAR\r\n';
  }

  /**
   * Dispara o download de um arquivo .txt no navegador/desktop
   */
  public static downloadFile(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=windows-1252' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
