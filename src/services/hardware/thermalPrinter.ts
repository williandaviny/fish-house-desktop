import { Venda, ItemVenda, EmpresaConfig, PedidoOnline } from '../../types/database';

export class ThermalPrinterService {
  /**
   * Gera HTML pronto para impressão térmica de Cupom Não Fiscal / Venda
   */
  public static printVendaCupom(venda: Venda, itens: ItemVenda[], config: EmpresaConfig) {
    const largura = config.impressora_largura === '58mm' ? '58mm' : '80mm';
    const agora = new Date(venda.created_at).toLocaleString('pt-BR');

    const itensHtml = itens.map(i => `
      <tr>
        <td style="text-align: left; padding: 2px 0;">
          ${i.produto_nome}<br/>
          <small>${i.quantidade} ${i.unit} x R$ ${i.preco_unitario.toFixed(2)}</small>
        </td>
        <td style="text-align: right; vertical-align: bottom; padding: 2px 0;">
          R$ ${i.subtotal.toFixed(2)}
        </td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Cupom #${venda.numero_venda}</title>
        <style>
          @page { size: ${largura} auto; margin: 0; }
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            color: #000;
            width: ${largura};
            margin: 0;
            padding: 8px;
            box-sizing: border-box;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          .total-row { font-size: 13px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="center bold" style="font-size: 14px;">${config.nome_empresa}</div>
        <div class="center">${config.cnpj ? 'CNPJ: ' + config.cnpj : ''}</div>
        <div class="center">${config.telefone}</div>
        <div class="center">${config.endereco}</div>
        <div class="divider"></div>
        <div class="center bold">CUPOM NÃO FISCAL</div>
        <div class="center">VENDA: #${venda.numero_venda} - ${agora}</div>
        ${venda.cliente_nome ? '<div>Cliente: ' + venda.cliente_nome + '</div>' : ''}
        <div class="divider"></div>
        <table>
          <thead>
            <tr style="border-bottom: 1px dashed #000;">
              <th style="text-align: left;">ITEM</th>
              <th style="text-align: right;">VALOR</th>
            </tr>
          </thead>
          <tbody>
            ${itensHtml}
          </tbody>
        </table>
        <div class="divider"></div>
        <table>
          <tr><td>Subtotal:</td><td style="text-align: right;">R$ ${venda.subtotal.toFixed(2)}</td></tr>
          ${venda.desconto > 0 ? '<tr><td>Desconto:</td><td style="text-align: right;">- R$ ' + venda.desconto.toFixed(2) + '</td></tr>' : ''}
          ${venda.acrescimo > 0 ? '<tr><td>Acréscimo:</td><td style="text-align: right;">+ R$ ' + venda.acrescimo.toFixed(2) + '</td></tr>' : ''}
          <tr class="total-row"><td>TOTAL:</td><td style="text-align: right;">R$ ${venda.valor_final.toFixed(2)}</td></tr>
          <tr><td>Pagamento:</td><td style="text-align: right;">${venda.forma_pagamento}</td></tr>
          ${venda.troco && venda.troco > 0 ? '<tr><td>Troco:</td><td style="text-align: right;">R$ ' + venda.troco.toFixed(2) + '</td></tr>' : ''}
        </table>
        <div class="divider"></div>
        <div class="center" style="font-size: 10px; margin-top: 6px;">
          ${config.mensagem_cupom}
        </div>
      </body>
      </html>
    `;

    this.openPrintWindow(html);
  }

  /**
   * Imprime Comanda de Preparo / Delivery
   */
  public static printComandaOnline(pedido: PedidoOnline, config: EmpresaConfig) {
    const largura = config.impressora_largura === '58mm' ? '58mm' : '80mm';
    const agora = new Date(pedido.created_at).toLocaleString('pt-BR');

    const itensHtml = pedido.itens.map(i => `
      <tr>
        <td style="text-align: left; padding: 3px 0; font-size: 13px;">
          <strong>${i.quantidade}x</strong> ${i.produto_nome}
        </td>
        <td style="text-align: right; vertical-align: bottom;">
          R$ ${i.subtotal.toFixed(2)}
        </td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Comanda #${pedido.numero_pedido}</title>
        <style>
          @page { size: ${largura} auto; margin: 0; }
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            color: #000;
            width: ${largura};
            margin: 0;
            padding: 8px;
            box-sizing: border-box;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          table { width: 100%; border-collapse: collapse; }
        </style>
      </head>
      <body>
        <div class="center bold" style="font-size: 16px;">PEDIDO DELIVERY</div>
        <div class="center bold" style="font-size: 14px;">#${pedido.numero_pedido}</div>
        <div class="center">${agora}</div>
        <div class="divider"></div>
        <div><strong>Cliente:</strong> ${pedido.cliente_nome}</div>
        <div><strong>Tel:</strong> ${pedido.cliente_telefone}</div>
        ${pedido.cliente_endereco ? '<div><strong>Endereço:</strong> ' + pedido.cliente_endereco + '</div>' : ''}
        <div><strong>Tipo:</strong> ${pedido.tipo_entrega.toUpperCase()}</div>
        <div class="divider"></div>
        <table>
          <tbody>
            ${itensHtml}
          </tbody>
        </table>
        <div class="divider"></div>
        <div style="font-size: 14px; font-weight: bold; display: flex; justify-content: space-between;">
          <span>TOTAL:</span>
          <span>R$ ${pedido.total.toFixed(2)}</span>
        </div>
        <div><strong>Pagamento:</strong> ${pedido.forma_pagamento}</div>
        ${pedido.observacoes ? '<div class="divider"></div><div><strong>Obs:</strong> ' + pedido.observacoes + '</div>' : ''}
      </body>
      </html>
    `;

    this.openPrintWindow(html);
  }

  private static openPrintWindow(html: string) {
    const printWindow = window.open('', '_blank', 'width=350,height=500');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }
}
