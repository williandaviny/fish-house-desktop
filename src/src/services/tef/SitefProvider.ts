import { ITefProvider } from './ITefProvider';
import { TefConfig, TefResponse, TefMessageCallback } from './types';

export class SitefProvider implements ITefProvider {
  private config!: TefConfig;
  private messageCallback: TefMessageCallback = () => {};
  private ws: WebSocket | null = null;

  async initialize(config: TefConfig): Promise<void> {
    this.config = config;
    const baseUrl = this.config.agentUrl || 'http://localhost:2018';
    
    this.triggerMessage('CONECTANDO AO AGENTE SITEF...');
    try {
      const response = await fetch(`${baseUrl}/api/tef/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pinpadPort: config.pinpadPort,
          storeCode: config.storeCode,
          terminalId: config.terminalId,
          cnpj: config.cnpj,
          timeout: config.timeoutSeconds
        })
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Erro desconhecido');
      }

      this.triggerMessage('SITEF INICIALIZADO COM SUCESSO.');
    } catch (err: any) {
      this.triggerMessage('ERRO AO INICIALIZAR SITEF: ' + err.message);
      throw new Error(`Falha na comunicação com o SiTef local: ${err.message}`);
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

  private setupWebSocket(baseUrl: string) {
    try {
      const wsUrl = baseUrl.replace(/^http/, 'ws') + '/tef-ws';
      this.ws = new WebSocket(wsUrl);
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'status_message' && data.message) {
          this.triggerMessage(data.message);
        }
      };
      this.ws.onerror = () => {
        console.warn('Conexão WebSocket com o agente TEF falhou. Status não será atualizado em tempo real.');
      };
    } catch (e) {
      console.warn('Erro ao configurar WebSocket:', e);
    }
  }

  private closeWebSocket() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  async processPayment(amount: number, type: 'credito' | 'debito' | 'pix', options?: any): Promise<TefResponse> {
    const baseUrl = this.config.agentUrl || 'http://localhost:2018';
    this.setupWebSocket(baseUrl);

    try {
      this.triggerMessage('INICIANDO TRANSAÇÃO SITEF...');
      const response = await fetch(`${baseUrl}/api/tef/payment`, {
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
        throw new Error(`Erro de rede no SiTef Local (Status: ${response.status})`);
      }

      const resData = await response.json();
      this.closeWebSocket();

      return {
        success: resData.success,
        message: resData.message || (resData.success ? 'APROVADO' : 'NEGADO'),
        nsu: resData.nsu || '',
        autorizacao: resData.autorizacao,
        bandeira: resData.bandeira,
        rede: resData.rede || 'SITEF',
        valor: amount,
        tipo: type,
        parcelas: options?.installments || 1,
        comprovante_cliente: resData.comprovante_cliente,
        comprovante_estabelecimento: resData.comprovante_estabelecimento,
        data_hora: new Date().toISOString()
      };
    } catch (err: any) {
      this.closeWebSocket();
      this.triggerMessage('ERRO NA TRANSAÇÃO: ' + err.message);
      throw err;
    }
  }

  async cancelTransaction(amount: number, nsu: string, options?: any): Promise<TefResponse> {
    const baseUrl = this.config.agentUrl || 'http://localhost:2018';
    try {
      this.triggerMessage('ENVIANDO REQUISIÇÃO DE CANCELAMENTO...');
      const response = await fetch(`${baseUrl}/api/tef/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valor: amount,
          nsu: nsu,
          pinpadPort: this.config.pinpadPort,
          storeCode: this.config.storeCode,
          terminalId: this.config.terminalId
        })
      });

      if (!response.ok) {
        throw new Error(`Erro ao conectar ao SiTef Local (Status: ${response.status})`);
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
      this.triggerMessage('ERRO AO CANCELAR: ' + err.message);
      throw err;
    }
  }

  async reprintTransaction(nsu: string, options?: any): Promise<TefResponse> {
    const baseUrl = this.config.agentUrl || 'http://localhost:2018';
    try {
      this.triggerMessage('REQUISITANDO REIMPRESSÃO AO SITEF...');
      const response = await fetch(`${baseUrl}/api/tef/reprint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nsu: nsu,
          pinpadPort: this.config.pinpadPort,
          storeCode: this.config.storeCode,
          terminalId: this.config.terminalId
        })
      });

      if (!response.ok) {
        throw new Error(`Erro ao conectar ao SiTef Local (Status: ${response.status})`);
      }

      const resData = await response.json();
      return {
        success: resData.success,
        message: resData.message || 'COMPROMANTE OBTIDO',
        nsu: nsu,
        valor: 0,
        tipo: 'debito',
        parcelas: 1,
        comprovante_cliente: resData.comprovante_cliente,
        comprovante_estabelecimento: resData.comprovante_estabelecimento,
        data_hora: new Date().toISOString()
      };
    } catch (err: any) {
      this.triggerMessage('ERRO AO REIMPRIMIR: ' + err.message);
      throw err;
    }
  }
}
