import { supabase } from '../lib/supabase';

// Prefilled global configuration from the user
const EVO_SERVER = 'https://appevo.voortz.com.br';
const EVO_GLOBAL_TOKEN = '3YM5vSdB61yOw1Uj9gXMVH0UQoXtNNyG';

export interface WhatsAppSettings {
  whatsapp_evo_enabled: boolean;
  whatsapp_evo_instance: string;
  whatsapp_evo_token: string;
  whatsapp_evo_group_id: string;
  whatsapp_evo_notify_client_status: boolean;
  whatsapp_evo_group_notifications: {
    new_order: boolean;
    status_changed: boolean;
    delivered: boolean;
    canceled: boolean;
  };
}

export function formatWhatsAppNumber(phone: string): string {
  if (phone.includes('@')) {
    return phone;
  }
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = '55' + cleaned;
  }
  return cleaned;
}

/**
 * Sends a raw text message via Evolution API
 */
export async function sendEvoMessage(instance: string, token: string, to: string, text: string): Promise<boolean> {
  if (!instance) {
    console.warn('Evolution API: Instance name is required.');
    return false;
  }

  // Use instance token, fall back to global token if empty
  const apiToken = token || EVO_GLOBAL_TOKEN;
  const endpoint = `${EVO_SERVER}/message/sendText/${instance}`;

  try {
    const formattedTo = formatWhatsAppNumber(to);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiToken,
      },
      body: JSON.stringify({
        number: formattedTo,
        text: text,
        delay: 1200,
        linkPreview: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Evolution API error response:', errText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Evolution API network/fetch error:', error);
    return false;
  }
}

/**
 * Fetch current WhatsApp configuration from site_settings table
 */
export async function getWhatsAppSettings(): Promise<WhatsAppSettings | null> {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('whatsapp_evo_enabled, whatsapp_evo_instance, whatsapp_evo_token, whatsapp_evo_group_id, whatsapp_evo_notify_client_status, whatsapp_evo_group_notifications')
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      whatsapp_evo_enabled: !!data.whatsapp_evo_enabled,
      whatsapp_evo_instance: data.whatsapp_evo_instance || '',
      whatsapp_evo_token: data.whatsapp_evo_token || '',
      whatsapp_evo_group_id: data.whatsapp_evo_group_id || '',
      whatsapp_evo_notify_client_status: !!data.whatsapp_evo_notify_client_status,
      whatsapp_evo_group_notifications: data.whatsapp_evo_group_notifications || {
        new_order: false,
        status_changed: false,
        delivered: false,
        canceled: false,
      },
    };
  } catch (err) {
    console.error('Error loading WhatsApp settings:', err);
    return null;
  }
}

/**
 * Translate order status for messaging templates
 */
function translateStatus(status: string): string {
  const map: Record<string, string> = {
    'pending': 'Recebido 🛒',
    'confirmed': 'Preparar 👨‍🍳',
    'processing': 'Em Preparo 🔪🐟',
    'shipped': 'Saiu para Entrega 🚚💨',
    'delivered': 'Entregue 🏁✨',
    'canceled': 'Cancelado ❌',
  };
  return map[status] || status;
}

/**
 * Formats delivery info for messaging
 */
function formatDeliveryAddress(order: any): string {
  if (order.delivery_type === 'pickup') {
    return 'Retirada na Loja 🏪';
  }
  return `${order.address_street || ''}, ${order.address_number || ''} - ${order.address_neighborhood || ''}, ${order.address_city || ''}`;
}

/**
 * Notify the customer about status change
 */
export async function notifyClientStatusChange(order: any): Promise<boolean> {
  const settings = await getWhatsAppSettings();
  if (!settings || !settings.whatsapp_evo_enabled || !settings.whatsapp_evo_notify_client_status) {
    return false;
  }

  const orderIdShort = order.id.slice(0, 8).toUpperCase();
  const statusStr = translateStatus(order.order_status);
  const customerName = order.customer_name;
  const destination = order.customer_whatsapp;

  if (!destination) return false;

  const cleanPhone = destination.replace(/\D/g, '');
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://peixariafishhouse.com.br';
  const trackingLink = `${origin}/meus-pedidos?phone=${cleanPhone}`;

  let text = '';
  switch (order.order_status) {
    case 'pending':
      text = `Olá, *${customerName}*! Seu pedido foi recebido com sucesso no *Fish House*! 🐠\n\n` +
             `*Pedido:* #${orderIdShort}\n` +
             `*Total:* R$ ${Number(order.final_amount).toFixed(2).replace('.', ',')}\n` +
             `*Forma de Pagamento:* ${order.payment_method.toUpperCase()}\n` +
             `*Tipo de Entrega:* ${order.delivery_type === 'pickup' ? 'Retirada' : 'Delivery'}\n\n` +
             `Estamos aguardando a confirmação/pagamento para iniciar a preparação. ⏳\n\n` +
             `Você pode acompanhar o status do seu pedido e ver seu histórico a qualquer momento clicando no link abaixo:\n` +
             `${trackingLink}\n\n` +
             `Agradecemos a preferência! ✨`;
      break;

    case 'confirmed':
      text = `Olá, *${customerName}*! Identificamos o pagamento do seu pedido *#${orderIdShort}*! 💰🐠\n\n` +
             `Seu pedido foi recebido e será preparado/separado em breve! 🔪🐟\n\n` +
             `Você pode acompanhar o status de preparação e entrega clicando no link abaixo:\n` +
             `${trackingLink}\n\n` +
             `Agradecemos a preferência! ✨`;
      break;

    case 'processing':
      text = `Olá, *${customerName}*! Boas notícias: o seu pedido *#${orderIdShort}* já está sendo preparado/separado! 🔪🐟\n\n` +
             `Você pode acompanhar o progresso clicando no link abaixo:\n` +
             `${trackingLink}\n\n` +
             `Logo mais ele estará pronto para ${order.delivery_type === 'pickup' ? 'retirada' : 'envio'}. Fique atento! ✨`;
      break;

    case 'shipped':
      text = `Olá, *${customerName}*! Seu pedido *#${orderIdShort}* foi enviado e já está a caminho! 🚚💨\n\n` +
             `Você pode acompanhar a entrega clicando no link abaixo:\n` +
             `${trackingLink}\n\n` +
             `Prepare-se para receber seu peixe fresco premium! 🐠`;
      break;

    case 'delivered':
      text = `Olá, *${customerName}*! Seu pedido *#${orderIdShort}* foi entregue! 🏁✨\n\n` +
             `Você pode ver seu histórico e detalhes dos seus pedidos clicando no link abaixo:\n` +
             `${trackingLink}\n\n` +
             `Esperamos que você goste de sua refeição. Bom apetite! Se puder, nos avalie. Agradecemos muito a sua preferência! 🐠💛`;
      break;

    case 'canceled':
      text = `Olá, *${customerName}*! O seu pedido *#${orderIdShort}* foi cancelado. ❌\n\n` +
             `Você pode ver seus pedidos clicando no link abaixo:\n` +
             `${trackingLink}\n\n` +
             `Caso tenha alguma dúvida ou queira falar conosco, estamos à disposição por aqui.`;
      break;

    default:
      text = `Olá, *${customerName}*! O status do seu pedido *#${orderIdShort}* foi atualizado para: *${statusStr}*.\n\n` +
             `Acompanhe no link abaixo:\n${trackingLink}`;
  }

  return sendEvoMessage(settings.whatsapp_evo_instance, settings.whatsapp_evo_token, destination, text);
}

/**
 * Notify the store's group about order events
 */
export async function notifyStoreGroup(order: any, items: any[] = [], eventType: 'new_order' | 'status_changed' | 'delivered' | 'canceled'): Promise<boolean> {
  const settings = await getWhatsAppSettings();
  if (!settings || !settings.whatsapp_evo_enabled || !settings.whatsapp_evo_group_id) {
    return false;
  }

  // Check if this specific group notification event is enabled in settings
  const isEnabled = settings.whatsapp_evo_group_notifications[eventType];
  if (!isEnabled) {
    return false;
  }

  const orderIdShort = order.id.slice(0, 8).toUpperCase();
  const customerName = order.customer_name;
  const finalAmount = Number(order.final_amount).toFixed(2).replace('.', ',');
  const deliveryStr = order.delivery_type === 'pickup' ? '🛒 RETIRADA' : '🚚 DELIVERY';
  const addressStr = formatDeliveryAddress(order);

  let text = '';

  if (eventType === 'new_order') {
    let itemsList = '';
    if (items && items.length > 0) {
      itemsList = items.map(i => `- ${i.quantity}x ${i.product_name}`).join('\n');
    } else {
      itemsList = '(Itens não carregados)';
    }

    text = `🚨 *NOVO PEDIDO RECEBIDO!* 🚨\n\n` +
           `*Pedido:* #${orderIdShort}\n` +
           `*Cliente:* ${customerName}\n` +
           `*WhatsApp:* ${order.customer_whatsapp || '(não informado)'}\n` +
           `*Tipo:* ${deliveryStr}\n` +
           `*Pagamento:* ${order.payment_method.toUpperCase()}\n` +
           `*Total:* R$ ${finalAmount}\n\n` +
           `*📋 ITENS:* \n${itemsList}\n\n` +
           `*📍 ENDEREÇO:* \n${addressStr}\n\n` +
           `Acesse o painel para gerenciar o pedido. ✨`;
  } else if (eventType === 'status_changed') {
    const statusStr = translateStatus(order.order_status);
    text = `🔄 *PEDIDO ALTERADO!* 🔄\n\n` +
           `*Pedido:* #${orderIdShort}\n` +
           `*Cliente:* ${customerName}\n` +
           `*Novo Status:* *${statusStr}*\n` +
           `*Tipo:* ${deliveryStr}\n` +
           `*Total:* R$ ${finalAmount}`;
  } else if (eventType === 'delivered') {
    text = `🏁 *PEDIDO ENTREGUE!* 🏁\n\n` +
           `*Pedido:* #${orderIdShort}\n` +
           `*Cliente:* ${customerName}\n` +
           `*Tipo:* ${deliveryStr}\n` +
           `*Valor:* R$ ${finalAmount}\n\n` +
           `Mais uma entrega concluída com sucesso! 🎉🐠`;
  } else if (eventType === 'canceled') {
    text = `❌ *PEDIDO CANCELADO!* ❌\n\n` +
           `*Pedido:* #${orderIdShort}\n` +
           `*Cliente:* ${customerName}\n` +
           `*Tipo:* ${deliveryStr}\n` +
           `*Valor:* R$ ${finalAmount}\n\n` +
           `Atenção: Este pedido foi marcado como cancelado.`;
  }

  return sendEvoMessage(settings.whatsapp_evo_instance, settings.whatsapp_evo_token, settings.whatsapp_evo_group_id, text);
}

/**
 * Notify the customer that their payment was confirmed
 */
export async function notifyClientPaymentConfirmed(order: any): Promise<boolean> {
  const settings = await getWhatsAppSettings();
  if (!settings || !settings.whatsapp_evo_enabled || !settings.whatsapp_evo_notify_client_status) {
    return false;
  }

  const orderIdShort = order.id.slice(0, 8).toUpperCase();
  const customerName = order.customer_name;
  const destination = order.customer_whatsapp;

  if (!destination) return false;

  const cleanPhone = destination.replace(/\D/g, '');
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://peixariafishhouse.com.br';
  const trackingLink = `${origin}/meus-pedidos?phone=${cleanPhone}`;

  const text = `Olá, *${customerName}*! Identificamos o pagamento do seu pedido *#${orderIdShort}*! 💰🐠\n\n` +
         `Seu pedido foi recebido e será preparado/separado em breve! 🔪🐟\n\n` +
         `Você pode acompanhar o status de preparação e entrega a qualquer momento clicando no link abaixo:\n` +
         `${trackingLink}\n\n` +
         `Agradecemos a preferência! ✨`;

  return sendEvoMessage(settings.whatsapp_evo_instance, settings.whatsapp_evo_token, destination, text);
}
