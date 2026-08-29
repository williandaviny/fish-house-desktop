import { ITefProvider } from './ITefProvider';
import { MockTefProvider } from './MockTefProvider';
import { SitefProvider } from './SitefProvider';
import { PayGoProvider } from './PayGoProvider';
import { GenericFileTefProvider } from './GenericFileTefProvider';
import { TefConfig, TefResponse, TefMessageCallback } from './types';

const STORAGE_KEY = 'tef_config';

const DEFAULT_CONFIG: TefConfig = {
  enabled: false,
  provider: 'mock',
  pinpadPort: 'COM3',
  storeCode: '00000000',
  terminalId: 'SW000001',
  cnpj: '00.000.000/0000-00',
  timeoutSeconds: 45,
  fileExchangeDir: 'C:\\Tef_Dial',
  agentUrl: 'http://localhost:2018'
};

export class TefService {
  private static instance: TefService | null = null;
  private currentConfig: TefConfig;
  private provider: ITefProvider | null = null;
  private messageCallback: TefMessageCallback = () => {};

  private constructor() {
    this.currentConfig = this.loadConfig();
    this.instantiateProvider();
  }

  public static getInstance(): TefService {
    if (!TefService.instance) {
      TefService.instance = new TefService();
    }
    return TefService.instance;
  }

  private loadConfig(): TefConfig {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  public getConfig(): TefConfig {
    return this.currentConfig;
  }

  public saveConfig(config: TefConfig): void {
    this.currentConfig = { ...config };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    this.instantiateProvider();
  }

  public isEnabled(): boolean {
    return this.currentConfig.enabled;
  }

  private instantiateProvider(): void {
    if (!this.currentConfig.enabled) {
      this.provider = null;
      return;
    }

    switch (this.currentConfig.provider) {
      case 'mock':
        this.provider = new MockTefProvider();
        break;
      case 'sitef':
        this.provider = new SitefProvider();
        break;
      case 'paygo':
        this.provider = new PayGoProvider();
        break;
      case 'generico':
        this.provider = new GenericFileTefProvider();
        break;
      default:
        this.provider = new MockTefProvider();
    }

    // Pass the message callback down if registered
    if (this.provider) {
      this.provider.onMessage(this.messageCallback);
      this.provider.initialize(this.currentConfig).catch(err => {
        console.error('[TefService] Falha ao inicializar o provedor:', err);
      });
    }
  }

  public onMessage(callback: TefMessageCallback): void {
    this.messageCallback = callback;
    if (this.provider) {
      this.provider.onMessage(callback);
    }
  }

  public async processPayment(amount: number, type: 'credito' | 'debito' | 'pix', options?: any): Promise<TefResponse> {
    if (!this.currentConfig.enabled || !this.provider) {
      throw new Error('Serviço TEF desabilitado ou não inicializado.');
    }
    return this.provider.processPayment(amount, type, options);
  }

  public async cancelTransaction(amount: number, nsu: string, options?: any): Promise<TefResponse> {
    if (!this.currentConfig.enabled || !this.provider) {
      throw new Error('Serviço TEF desabilitado ou não inicializado.');
    }
    return this.provider.cancelTransaction(amount, nsu, options);
  }

  public async reprintTransaction(nsu: string, options?: any): Promise<TefResponse> {
    if (!this.currentConfig.enabled || !this.provider) {
      throw new Error('Serviço TEF desabilitado ou não inicializado.');
    }
    return this.provider.reprintTransaction(nsu, options);
  }
}

export const tefService = TefService.getInstance();
