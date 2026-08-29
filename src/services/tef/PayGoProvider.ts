import { ITefProvider } from './ITefProvider';
import { TefConfig, TefResponse, TefMessageCallback } from './types';

export class PayGoProvider implements ITefProvider {
  private config!: TefConfig;
  private messageCallback: TefMessageCallback = () => {};

  async initialize(config: TefConfig): Promise<void> {
    this.config = config;
    const baseUrl = this.config.agentUrl || 'http://localhost:5105'; // Default PayGo agent port is often different, e.g. 5105 or 8000
    
    this.triggerMessage('CONECTANDO AO AGENTE PAYGO...');
    try {
      const response = await fetch(`${baseUrl}/api/paygo/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pinpadPort: config.pinpadPort,
          storeCode: config.storeCode,
          terminalId: config.terminalId,
          cnpj: config.cnpj
        })
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Erro desconhecido');
      }

      this.triggerMessage('PAYGO INICIALIZADO COM SUCESSO.');
    } catch (err: any) {
      this.triggerMessage('ERRO AO INICIALIZAR PAYGO: ' + err.message);
      throw new Error(`Falha na comunicação com o PayGo local: ${err.message}`);
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
    const baseUrl = this.config.agentUrl || 'http://localhost:5105';
    this.triggerMessage('AGUARDANDO CARTÃO/CONFIRMAÇÃO NO PIN PAD...');

    try {
      const response = await fetch(`${baseUrl}/api/paygo/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valor: amount,
          tipo: type,
          parcelas: options?.installments || 1,
          pinpadPort: this.config.pinpadPort,
          storeCode: this.config.storeCode,
          terminalId: this.config.terminalId
        })
      });

      if (!response.ok) {
        throw new Error(`Erro de rede no PayGo Local (Status: ${response.status})`);
      }

      const resData = await response.json();
      return {
        success: resData.success,
        message: resData.message || (resData.success ? 'APROVADO' : 'NEGADO'),
        nsu: resData.nsu || '',
        autorizacao: resData.autorizacao,
        bandeira: resData.bandeira,
        rede: resData.rede || 'PAYGO',
        valor: amount,
        tipo: type,
        parcelas: options?.installments || 1,
        comprovante_cliente: resData.comprovante_cliente,
        comprovante_estabelecimento: resData.comprovante_estabelecimento,
        data_hora: new Date().toISOString()
      };
    } catch (err: any) {
      this.triggerMessage('ERRO NA TRANSAÇÃO PAYGO: ' + err.message);
      throw err;
    }
  }

  async cancelTransaction(amount: number, nsu: string, options?: any): Promise<TefResponse> {
    const baseUrl = this.config.agentUrl || 'http://localhost:5105';
    try {
      this.triggerMessage('ENVIANDO CANCELAMENTO AO PAYGO...');
      const response = await fetch(`${baseUrl}/api/paygo/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valor: amount,
          nsu: nsu,
          pinpadPort: this.config.pinpadPort
        })
      });

      if (!response.ok) {
        throw new Error(`Erro ao conectar ao PayGo Local (Status: ${response.status})`);
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
      this.triggerMessage('ERRO AO CANCELAR NO PAYGO: ' + err.message);
      throw err;
    }
  }

  async reprintTransaction(nsu: string, options?: any): Promise<TefResponse> {
    const baseUrl = this.config.agentUrl || 'http://localhost:5105';
    try {
      this.triggerMessage('SOLICITANDO REIMPRESSÃO AO PAYGO...');
      const response = await fetch(`${baseUrl}/api/paygo/reprint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nsu: nsu
        })
      });

      if (!response.ok) {
        throw new Error(`Erro ao conectar ao PayGo Local (Status: ${response.status})`);
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
      this.triggerMessage('ERRO AO REIMPRIMIR NO PAYGO: ' + err.message);
      throw err;
    }
  }
}
