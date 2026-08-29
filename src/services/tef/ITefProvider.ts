import { TefConfig, TefResponse, TefMessageCallback } from './types';

export interface ITefProvider {
  initialize(config: TefConfig): Promise<void>;
  processPayment(amount: number, type: 'credito' | 'debito' | 'pix', options?: any): Promise<TefResponse>;
  cancelTransaction(amount: number, nsu: string, options?: any): Promise<TefResponse>;
  reprintTransaction(nsu: string, options?: any): Promise<TefResponse>;
  onMessage(callback: TefMessageCallback): void;
}
