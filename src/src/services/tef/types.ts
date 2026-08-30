export type TefProviderType = 'sitef' | 'paygo' | 'generico' | 'mock';

export interface TefConfig {
  enabled: boolean;
  provider: TefProviderType;
  pinpadPort: string; // e.g., 'COM3', 'COM4'
  storeCode: string;
  terminalId: string;
  cnpj: string;
  timeoutSeconds: number;
  fileExchangeDir?: string; // For Generic File TEF
  agentUrl?: string; // URL of local bridge server (e.g. 'http://localhost:2018')
}

export interface TefResponse {
  success: boolean;
  message: string;
  nsu: string;
  autorizacao?: string;
  bandeira?: string;
  rede?: string;
  valor: number;
  tipo: 'credito' | 'debito' | 'pix';
  parcelas: number;
  comprovante_cliente?: string;
  comprovante_estabelecimento?: string;
  data_hora: string;
}

export type TefMessageCallback = (message: string) => void;
