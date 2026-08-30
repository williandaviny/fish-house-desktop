import { ITefProvider } from './ITefProvider';
import { TefConfig, TefResponse, TefMessageCallback } from './types';

export class MockTefProvider implements ITefProvider {
  private config!: TefConfig;
  private messageCallback: TefMessageCallback = () => {};

  async initialize(config: TefConfig): Promise<void> {
    this.config = config;
    this.triggerMessage('INICIALIZANDO PIN PAD MOCK NA PORTA ' + config.pinpadPort + '...');
    await this.delay(600);
    this.triggerMessage('PIN PAD PPC930 MOCK PRONTO.');
  }

  onMessage(callback: TefMessageCallback): void {
    this.messageCallback = callback;
  }

  private triggerMessage(msg: string) {
    if (this.messageCallback) {
      this.messageCallback(msg);
    }
    console.log(`[TEF MOCK] ${msg}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async processPayment(amount: number, type: 'credito' | 'debito' | 'pix', options?: any): Promise<TefResponse> {
    const behavior = localStorage.getItem('tef_mock_behavior') || 'success';
    const installments = options?.installments || 1;

    this.triggerMessage('AGUARDANDO CARTÃO NO PIN PAD...');
    await this.delay(1500);

    if (behavior === 'error') {
      this.triggerMessage('ERRO: PIN PAD DESCONECTADO (COMUNICAÇÃO FALHOU)');
      throw new Error('Falha de comunicação com o pin pad PPC930.');
    }

    if (type !== 'pix') {
      this.triggerMessage('CARTÃO INSERIDO.');
      await this.delay(800);
      this.triggerMessage('DIGITE A SENHA NO PIN PAD E PRESSIONE ENTER...');
      await this.delay(2000);
    } else {
      this.triggerMessage('GERANDO QR CODE PIX NO PIN PAD...');
      await this.delay(1000);
      this.triggerMessage('QR CODE EXIBIDO. AGUARDANDO PAGAMENTO PELO CLIENTE...');
      await this.delay(2000);
    }

    this.triggerMessage('PROCESSANDO TRANSAÇÃO COM O PROVEDOR TEF...');
    await this.delay(1500);

    if (behavior === 'timeout') {
      this.triggerMessage('ERRO: TEMPO LIMITE DE TRANSAÇÃO EXCEDIDO');
      throw new Error('Timeout: O provedor TEF não respondeu a tempo.');
    }

    if (behavior === 'reject') {
      this.triggerMessage('TRANSAÇÃO NEGADA PELA ADQUIRENTE');
      return {
        success: false,
        message: 'TRANSACAO NEGADA: SALDO INSUFICIENTE',
        nsu: '',
        valor: amount,
        tipo: type,
        parcelas: installments,
        data_hora: new Date().toISOString()
      };
    }

    // Success flow
    const nsu = Math.floor(100000000 + Math.random() * 900000000).toString();
    const autorizacao = Math.floor(100000 + Math.random() * 900000).toString();
    const rede = type === 'pix' ? 'PIX' : 'REDECAR';
    const bandeira = type === 'pix' ? 'PIX' : (type === 'debito' ? 'MAESTRO' : 'MASTERCARD');
    const dataHoraStr = new Date().toLocaleString('pt-BR');

    const comprovanteComum = `
----------------------------------------
               FISH HOUSE               
            PEIXARIA PREMIUM            
          CNPJ: ${this.config.cnpj || '12.345.678/0001-90'}
----------------------------------------
COMPROVANTE DE TRANSACAO TEF
VIA: {VIA}
----------------------------------------
NSU: ${nsu}      AUTORIZACAO: ${autorizacao}
REDE: ${rede}    BANDEIRA: ${bandeira}
VALOR: R$ ${amount.toFixed(2)}
TIPO: ${type.toUpperCase()} ${installments > 1 ? `(${installments}X)` : ''}
DATA/HORA: ${dataHoraStr}
----------------------------------------
         APROVADO COM SUCESSO         
----------------------------------------
`;

    const comprovanteCliente = comprovanteComum.replace('{VIA}', 'CLIENTE');
    const comprovanteEstabelecimento = comprovanteComum.replace('{VIA}', 'ESTABELECIMENTO');

    this.triggerMessage('TRANSAÇÃO APROVADA!');
    return {
      success: true,
      message: 'APROVADO',
      nsu,
      autorizacao,
      rede,
      bandeira,
      valor: amount,
      tipo: type,
      parcelas: installments,
      comprovante_cliente: comprovanteCliente,
      comprovante_estabelecimento: comprovanteEstabelecimento,
      data_hora: new Date().toISOString()
    };
  }

  async cancelTransaction(amount: number, nsu: string, options?: any): Promise<TefResponse> {
    this.triggerMessage('INICIANDO CANCELAMENTO ADMINISTRATIVO...');
    await this.delay(1000);
    this.triggerMessage(`PROCURANDO NSU ${nsu} NO SISTEMA...`);
    await this.delay(1000);
    this.triggerMessage('DIGITE A SENHA DO GERENTE NO PIN PAD...');
    await this.delay(1500);
    this.triggerMessage('PROCESSANDO ESTORNO...');
    await this.delay(1000);

    const dataHoraStr = new Date().toLocaleString('pt-BR');
    const comprovante = `
----------------------------------------
               FISH HOUSE               
            PEIXARIA PREMIUM            
----------------------------------------
ESTORNO DE TRANSACAO TEF
NSU ORIGINAL: ${nsu}
VALOR CANCELADO: R$ ${amount.toFixed(2)}
DATA/HORA: ${dataHoraStr}
----------------------------------------
        ESTORNADO COM SUCESSO         
----------------------------------------
`;

    this.triggerMessage('TRANSAÇÃO ESTORNADA/CANCELADA!');
    return {
      success: true,
      message: 'CANCELADO',
      nsu,
      valor: amount,
      tipo: 'debito',
      parcelas: 1,
      comprovante_cliente: comprovante,
      comprovante_estabelecimento: comprovante,
      data_hora: new Date().toISOString()
    };
  }

  async reprintTransaction(nsu: string, options?: any): Promise<TefResponse> {
    this.triggerMessage('Buscando transação para reimpressão...');
    await this.delay(1000);
    
    // Check if we have a transaction history in localStorage to grab
    // Otherwise fallback to generating a generic duplicate receipt
    return {
      success: true,
      message: 'REIMPRESSO',
      nsu,
      valor: 0,
      tipo: 'debito',
      parcelas: 1,
      comprovante_cliente: `*** REIMPRESSAO (DUPLICATA) ***\nNSU: ${nsu}\nTRANSACAO REIMPRESSA COM SUCESSO\n*******************************`,
      comprovante_estabelecimento: `*** REIMPRESSAO (DUPLICATA) ***\nNSU: ${nsu}\nTRANSACAO REIMPRESSA COM SUCESSO\n*******************************`,
      data_hora: new Date().toISOString()
    };
  }
}
