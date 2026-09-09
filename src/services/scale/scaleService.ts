// src/services/scale/scaleService.ts

export type ScaleStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ScaleConfig {
  baudRate: number;
  dataBits: 7 | 8;
  stopBits: 1 | 2;
  parity: 'none' | 'even' | 'odd';
  autoPoll: boolean;
  pollInterval: number; // ms, default 500
  autoConnect: boolean;
  protocol: 'toledo' | 'generic';
}

export interface ScaleState {
  status: ScaleStatus;
  weight: number; // in kg
  rawResponse: string;
  error: string | null;
  config: ScaleConfig;
  isStable?: boolean;
}

const DEFAULT_CONFIG: ScaleConfig = {
  baudRate: 2400,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  autoPoll: true,
  pollInterval: 500,
  autoConnect: true,
  protocol: 'toledo',
};

const STORAGE_KEY = 'fishhouse_scale_config';

class ScaleService {
  private port: any = null;
  private reader: any = null;
  private writer: any = null;
  private pollTimer: any = null;
  private buffer: string = '';
  private isReading: boolean = false;
  private listeners: Set<(state: ScaleState) => void> = new Set();
  private initialized: boolean = false;

  private state: ScaleState = {
    status: 'disconnected',
    weight: 0,
    rawResponse: '',
    error: null,
    config: this.loadConfig(),
    isStable: true,
  };

  constructor() {
    // Attempt auto-reconnect if supported
    if (typeof window !== 'undefined' && 'navigator' in window && (navigator as any).serial) {
      // Listen for connect/disconnect hardware events
      (navigator as any).serial.addEventListener?.('disconnect', () => {
        this.handleDisconnect('Balança desconectada fisicamente da porta USB/Serial.');
      });
    }
  }

  public getState(): ScaleState {
    return { ...this.state };
  }

  public subscribe(listener: (state: ScaleState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach((listener) => listener(currentState));
  }

  private loadConfig(): ScaleConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Erro ao carregar configurações da balança:', e);
    }
    return DEFAULT_CONFIG;
  }

  public setConfig(newConfig: Partial<ScaleConfig>) {
    this.state.config = { ...this.state.config, ...newConfig };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state.config));
    } catch (e) {
      console.error('Erro ao salvar configurações da balança:', e);
    }
    this.notify();

    // If polling setting changed while connected, adjust timer
    if (this.state.status === 'connected') {
      if (this.state.config.autoPoll) {
        this.startPolling();
      } else {
        this.stopPolling();
      }
    }
  }

  public async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    if (typeof window === 'undefined' || !(navigator as any).serial) {
      return;
    }

    if (this.state.config.autoConnect) {
      try {
        const ports = await (navigator as any).serial.getPorts();
        if (ports && ports.length > 0) {
          // Use previously granted port
          await this.connectWithPort(ports[0]);
        }
      } catch (err: any) {
        console.warn('Auto-reconexão da balança não concluída:', err);
      }
    }
  }

  public async connect(forcePrompt: boolean = false): Promise<boolean> {
    if (typeof window === 'undefined' || !(navigator as any).serial) {
      this.state.status = 'error';
      this.state.error = 'Web Serial API não suportada neste navegador. Utilize Google Chrome ou Edge.';
      this.notify();
      return false;
    }

    // If port is already opened and connected, no need to reopen
    if (this.port && this.state.status === 'connected') {
      return true;
    }

    this.state.status = 'connecting';
    this.state.error = null;
    this.notify();

    try {
      let targetPort: any = null;

      if (!forcePrompt) {
        const existingPorts = await (navigator as any).serial.getPorts();
        if (existingPorts && existingPorts.length > 0) {
          targetPort = existingPorts[0];
        }
      }

      if (!targetPort) {
        targetPort = await (navigator as any).serial.requestPort();
      }

      return await this.connectWithPort(targetPort);
    } catch (err: any) {
      console.error('Erro ao conectar com a balança:', err);
      if (err.name === 'NotFoundError') {
        // User cancelled picker dialog
        this.state.status = 'disconnected';
        this.state.error = null;
      } else {
        this.state.status = 'error';
        this.state.error = err.message || 'Falha ao solicitar porta serial.';
      }
      this.notify();
      return false;
    }
  }

  private async connectWithPort(port: any): Promise<boolean> {
    try {
      this.port = port;

      // Check if port is already open
      const isOpen = port.readable !== null || (port as any).isOpen;

      if (!isOpen) {
        await port.open({
          baudRate: this.state.config.baudRate,
          dataBits: this.state.config.dataBits,
          stopBits: this.state.config.stopBits,
          parity: this.state.config.parity,
        });
      }

      this.state.status = 'connected';
      this.state.error = null;
      this.notify();

      // Start reading stream
      this.startReading();

      // Start auto-poll if configured
      if (this.state.config.autoPoll) {
        this.startPolling();
      }

      return true;
    } catch (err: any) {
      console.error('Erro ao abrir porta serial da balança:', err);
      // Check if error is "already open"
      if (err.message && err.message.toLowerCase().includes('already open')) {
        this.state.status = 'connected';
        this.state.error = null;
        this.notify();
        this.startReading();
        if (this.state.config.autoPoll) {
          this.startPolling();
        }
        return true;
      }

      this.state.status = 'error';
      this.state.error = err.message || 'Erro ao comunicar com a porta serial.';
      this.notify();
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    this.stopPolling();
    this.isReading = false;

    try {
      if (this.reader) {
        await this.reader.cancel().catch(() => {});
        this.reader.releaseLock?.();
        this.reader = null;
      }
      if (this.writer) {
        this.writer.releaseLock?.();
        this.writer = null;
      }
      if (this.port) {
        await this.port.close().catch(() => {});
        this.port = null;
      }
    } catch (e) {
      console.warn('Erro ao fechar conexão com a balança:', e);
    } finally {
      this.handleDisconnect();
    }
  }

  private handleDisconnect(customError?: string) {
    this.stopPolling();
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.isReading = false;
    this.state.status = 'disconnected';
    if (customError) {
      this.state.error = customError;
    }
    this.notify();
  }

  /**
   * Sends byte 0x05 (ENQ) to request weight from Toledo scale
   */
  public async requestWeight(): Promise<void> {
    if (!this.port || this.state.status !== 'connected') {
      return;
    }

    try {
      if (!this.port.writable) {
        return;
      }

      // Toledo Prix 3 Plus responds to ENQ (0x05)
      const writer = this.port.writable.getWriter();
      const enq = new Uint8Array([0x05]);
      await writer.write(enq);
      writer.releaseLock();
    } catch (err: any) {
      console.error('Erro ao enviar comando ENQ para balança:', err);
    }
  }

  private startPolling() {
    this.stopPolling();
    // Poll every interval (e.g. 500ms)
    this.pollTimer = setInterval(() => {
      this.requestWeight();
    }, Math.max(300, this.state.config.pollInterval));
    
    // First immediate poll
    this.requestWeight();
  }

  private stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async startReading() {
    if (this.isReading || !this.port || !this.port.readable) return;
    this.isReading = true;

    try {
      while (this.port && this.port.readable && this.isReading) {
        this.reader = this.port.readable.getReader();
        try {
          while (true) {
            const { value, done } = await this.reader.read();
            if (done) break;
            if (value && value.length > 0) {
              this.processIncomingBytes(value);
            }
          }
        } catch (readErr: any) {
          console.warn('Leitura serial interrompida:', readErr);
        } finally {
          this.reader.releaseLock?.();
          this.reader = null;
        }
      }
    } catch (err: any) {
      console.error('Erro no loop do leitor serial:', err);
    } finally {
      this.isReading = false;
    }
  }

  private processIncomingBytes(bytes: Uint8Array) {
    // Convert bytes to string, recording special characters
    let chunk = '';
    let visualChunk = '';

    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      chunk += String.fromCharCode(b);

      // Visual debug representation matching the test program (e.g. #2 0 0 4 5 4 #3)
      if (b === 0x02) {
        visualChunk += '#2 ';
      } else if (b === 0x03) {
        visualChunk += '#3 ';
      } else if (b >= 32 && b <= 126) {
        visualChunk += String.fromCharCode(b) + ' ';
      } else {
        visualChunk += '#' + b.toString(16) + ' ';
      }
    }

    this.buffer += chunk;
    this.state.rawResponse = visualChunk.trim();

    // Check if buffer contains frame termination (STX/ETX or CRLF)
    if (
      this.buffer.includes('\u0003') || // ETX
      this.buffer.includes('\r') ||
      this.buffer.includes('\n')
    ) {
      this.parseBuffer();
    }
  }

  private parseBuffer() {
    // Look for Toledo STX (\u0002) ... ETX (\u0003)
    const stxIdx = this.buffer.lastIndexOf('\u0002');
    const etxIdx = this.buffer.lastIndexOf('\u0003');

    let payload = '';

    if (stxIdx !== -1 && etxIdx !== -1 && etxIdx > stxIdx) {
      // Direct STX...ETX frame
      payload = this.buffer.substring(stxIdx + 1, etxIdx);
      this.buffer = this.buffer.substring(etxIdx + 1);
    } else {
      // Split by CRLF
      const parts = this.buffer.split(/[\r\n\u0003]/);
      if (parts.length > 1) {
        for (let i = parts.length - 2; i >= 0; i--) {
          const p = parts[i].replace(/\u0002/g, '').trim();
          if (p.length > 0) {
            payload = p;
            break;
          }
        }
        this.buffer = parts[parts.length - 1];
      }
    }

    if (payload) {
      this.interpretPayload(payload);
    }
  }

  private interpretPayload(payload: string) {
    // Toledo Prix typically sends 5 or 6 digits of weight: e.g. "00454" = 0.454 kg
    // If payload contains decimal dot, e.g. "0.454"
    const cleanNumbers = payload.replace(/[^\d.]/g, '');

    if (!cleanNumbers) return;

    let parsedWeight = 0;

    if (cleanNumbers.includes('.')) {
      parsedWeight = parseFloat(cleanNumbers);
    } else {
      // In Toledo Prix, digits without decimal represent grams (e.g. 00454 -> 454g = 0.454kg)
      const grams = parseInt(cleanNumbers, 10);
      if (!isNaN(grams)) {
        parsedWeight = grams / 1000;
      }
    }

    if (!isNaN(parsedWeight) && parsedWeight >= 0 && parsedWeight < 1000) {
      this.state.weight = parsedWeight;
      this.notify();
    }
  }
}

export const scaleService = new ScaleService();
