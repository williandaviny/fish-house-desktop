import { ITefProvider } from './ITefProvider';
import { TefConfig, TefResponse, TefMessageCallback } from './types';

export class GenericFileTefProvider implements ITefProvider {
  private config!: TefConfig;
  private messageCallback: TefMessageCallback = () => {};

  async initialize(config: TefConfig): Promise<void> {
    this.config = config;
    const baseUrl = this.config.agentUrl || 'http://localhost:3003';
    
    this.triggerMessage('VERIFICANDO DIRETÓRIO DE ARQUIVOS TEF...');
    try {
      const response = await fetch(`${baseUrl}/api/file-tef/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directory: config.fileExchangeDir || 'C:\\Tef_Dial'
        })
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Diretório inacessível');
      }

      this.triggerMessage('GERENCIADOR PADRÃO PRONTO.');
    } catch (err: any) {
      this.triggerMessage('ERRO DIRETÓRIO TEF: ' + err.message);
      throw new Error(`Falha na comunicação com o Agente de Arquivo local: ${err.message}`);
    }
  }

  onMessage(callback: TefMessageCallback): void {
    this.messageCallback = callback;
  }

  private triggerMessage(msg: string) {
    if (this.messageCallback) {
      this.messageCallback(msg);
    }
  }

  async processPayment(amount: number, type: 'credito' | 'debito' | 'pix', options?: any): Promise<TefResponse> {
    const baseUrl = this.config.agentUrl || 'http://localhost:3003';
    this.triggerMessage('AGUARDANDO CARTÃO NO GERENCIADOR PADRÃO...');

    try {
      const response = await fetch(`${baseUrl}/api/file-tef/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valor: amount,
          tipo: type,
          parcelas: options?.installments || 1,
          directory: this.config.fileExchangeDir || 'C:\\Tef_Dial',
          cnpj: this.config.cnpj,
          timeout: this.config.timeoutSeconds
        })
      });

      if (!response.ok) {
        throw new Error(`Erro de comunicação com o Agente de Arquivos (Status: ${response.status})`);
      }

      const resData = await response.json();
      return {
        success: resData.success,
        message: resData.message || (resData.success ? 'APROVADO' : 'NEGADO'),
        nsu: resData.nsu || '',
        autorizacao: resData.autorizacao,
        bandeira: resData.bandeira,
        rede: resData.rede || 'TEF_ARQUIVO',
        valor: amount,
        tipo: type,
        parcelas: options?.installments || 1,
        comprovante_cliente: resData.comprovante_cliente,
        comprovante_estabelecimento: resData.comprovante_estabelecimento,
        data_hora: new Date().toISOString()
      };
    } catch (err: any) {
      this.triggerMessage('ERRO NO PROCESSAMENTO DE ARQUIVO: ' + err.message);
      throw err;
    }
  }

  async cancelTransaction(amount: number, nsu: string, options?: any): Promise<TefResponse> {
    const baseUrl = this.config.agentUrl || 'http://localhost:3003';
    try {
      this.triggerMessage('ENVIANDO ARQUIVO DE CANCELAMENTO...');
      const response = await fetch(`${baseUrl}/api/file-tef/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valor: amount,
          nsu: nsu,
          directory: this.config.fileExchangeDir || 'C:\\Tef_Dial'
        })
      });

      if (!response.ok) {
        throw new Error(`Erro de rede no Agente de Arquivos (Status: ${response.status})`);
      }

      const resData = await response.json();
      return {
        success: resData.success,
        message: resData.message || (resData.success ? 'CANCELADO' : 'ERRO AO CANCELAR'),
        nsu: nsu,
        valor: amount,
        tipo: 'debito',
        parcelas: 1,
        comprovante_cliente: resData.comprovante_cliente,
        comprovante_estabelecimento: resData.comprovante_estabelecimento,
        data_hora: new Date().toISOString()
      };
    } catch (err: any) {
      this.triggerMessage('ERRO AO CANCELAR POR ARQUIVO: ' + err.message);
      throw err;
    }
  }

  async reprintTransaction(nsu: string, options?: any): Promise<TefResponse> {
    const baseUrl = this.config.agentUrl || 'http://localhost:3003';
    try {
      this.triggerMessage('REQUISITANDO REIMPRESSÃO POR ARQUIVO...');
      const response = await fetch(`${baseUrl}/api/file-tef/reprint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nsu: nsu,
          directory: this.config.fileExchangeDir || 'C:\\Tef_Dial'
        })
      });

      if (!response.ok) {
        throw new Error(`Erro de rede no Agente de Arquivos (Status: ${response.status})`);
      }

      const resData = await response.json();
      return {
        success: resData.success,
        message: resData.message || 'REIMPRESSO',
        nsu: nsu,
        valor: 0,
        tipo: 'debito',
        parcelas: 1,
        comprovante_cliente: resData.comprovante_cliente,
        comprovante_estabelecimento: resData.comprovante_estabelecimento,
        data_hora: new Date().toISOString()
      };
    } catch (err: any) {
      this.triggerMessage('ERRO AO REIMPRIMIR POR ARQUIVO: ' + err.message);
      throw err;
    }
  }
}
