import { MockTefProvider } from './MockTefProvider';
import { TefConfig } from './types';

// Mock localStorage for Node environment test execution
const storageMock: { [key: string]: string } = {};
global.localStorage = {
  getItem: (key: string) => storageMock[key] || null,
  setItem: (key: string, value: string) => { storageMock[key] = value; },
  removeItem: (key: string) => { delete storageMock[key]; },
  clear: () => { Object.keys(storageMock).forEach(key => delete storageMock[key]); },
  key: (index: number) => Object.keys(storageMock)[index] || null,
  length: 0
};

Object.defineProperty(global.localStorage, 'length', {
  get: () => Object.keys(storageMock).length
});

const mockConfig: TefConfig = {
  enabled: true,
  provider: 'mock',
  pinpadPort: 'COM3',
  storeCode: '12345678',
  terminalId: 'PDV01',
  cnpj: '12.345.678/0001-99',
  timeoutSeconds: 30
};

async function runTests() {
  console.log('🧪 Iniciando testes unitários do Módulo TEF...\n');
  let passedCount = 0;
  let failedCount = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passedCount++;
    } catch (err: any) {
      console.error(`❌ FAIL: ${name}`);
      console.error(`   Motivo: ${err.message || err}`);
      failedCount++;
    }
  }

  // Instanciar o Provider Mock para os testes
  const provider = new MockTefProvider();
  await provider.initialize(mockConfig);

  // Teste 1: Pagamento TEF Aprovado
  await test('Deve aprovar pagamento TEF com sucesso e gerar comprovantes', async () => {
    localStorage.setItem('tef_mock_behavior', 'success');
    const res = await provider.processPayment(150.00, 'credito', { installments: 2 });
    
    if (!res.success) throw new Error('Pagamento falhou');
    if (res.valor !== 150.00) throw new Error('Valor incorreto');
    if (res.tipo !== 'credito') throw new Error('Tipo incorreto');
    if (res.parcelas !== 2) throw new Error('Parcelas incorretas');
    if (!res.nsu) throw new Error('NSU não gerado');
    if (!res.autorizacao) throw new Error('Código de autorização não gerado');
    if (!res.comprovante_cliente) throw new Error('Comprovante do cliente não gerado');
    if (!res.comprovante_estabelecimento) throw new Error('Comprovante do estabelecimento não gerado');
    if (!res.comprovante_cliente.includes('VIA: CLIENTE')) throw new Error('Marcador de via cliente ausente');
  });

  // Teste 2: Pagamento TEF Negado
  await test('Deve negar pagamento TEF quando saldo for insuficiente', async () => {
    localStorage.setItem('tef_mock_behavior', 'reject');
    const res = await provider.processPayment(100.00, 'debito');
    
    if (res.success) throw new Error('Pagamento deveria ter sido negado');
    if (!res.message.includes('NEGADA')) throw new Error('Mensagem de recusa incorreta');
    if (res.nsu) throw new Error('NSU não deveria ter sido gerado');
  });

  // Teste 3: Timeout de Transação
  await test('Deve lançar erro por Timeout no TEF', async () => {
    localStorage.setItem('tef_mock_behavior', 'timeout');
    try {
      await provider.processPayment(50.00, 'debito');
      throw new Error('Deveria ter lançado erro de Timeout');
    } catch (err: any) {
      if (!err.message.includes('Timeout')) {
        throw new Error('Erro lançado não é de Timeout: ' + err.message);
      }
    }
  });

  // Teste 4: Erro de Comunicação com Pin Pad
  await test('Deve lançar erro de comunicação física com o pin pad', async () => {
    localStorage.setItem('tef_mock_behavior', 'error');
    try {
      await provider.processPayment(200.00, 'credito');
      throw new Error('Deveria ter lançado erro de comunicação');
    } catch (err: any) {
      if (!err.message.includes('comunicação')) {
        throw new Error('Erro lançado não é de comunicação: ' + err.message);
      }
    }
  });

  // Teste 5: Cancelamento / Estorno
  await test('Deve estornar transação e gerar comprovante de cancelamento', async () => {
    const res = await provider.cancelTransaction(150.00, '987654321');
    if (!res.success) throw new Error('Cancelamento falhou');
    if (!res.comprovante_cliente?.includes('ESTORNO DE TRANSACAO TEF')) {
      throw new Error('Comprovante de estorno mal formatado');
    }
  });

  // Teste 6: Reimpressão
  await test('Deve gerar comprovante duplicado para reimpressão', async () => {
    const res = await provider.reprintTransaction('123456');
    if (!res.success) throw new Error('Reimpressão falhou');
    if (!res.comprovante_cliente?.includes('REIMPRESSAO (DUPLICATA)')) {
      throw new Error('Comprovante de reimpressão incorreto');
    }
  });

  console.log(`\n📊 Resumo dos Testes:`);
  console.log(`   Passou: ${passedCount}`);
  console.log(`   Falhou: ${failedCount}`);

  if (failedCount > 0) {
    process.exit(1);
  } else {
    console.log('\n🎉 Todos os testes passaram com sucesso!');
  }
}

runTests();
