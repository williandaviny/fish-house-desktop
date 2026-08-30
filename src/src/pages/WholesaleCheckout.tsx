import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  MapPin, 
  ChevronLeft, 
  ShoppingBag, 
  FileText, 
  CheckCircle2, 
  Phone, 
  Truck, 
  Store,
  RefreshCcw,
  ArrowRight,
  Clock,
  AlertCircle
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSettings } from '../hooks/useSettings';

type Step = 'form' | 'success';

export default function WholesaleCheckout() {
  const { items, cartTotal, clearCart } = useCart();
  const navigate = useNavigate();
  const { settings } = useSettings();
  
  const [currentStep, setCurrentStep] = useState<Step>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  const [deliveryZones, setDeliveryZones] = useState<{neighborhood_name: string, fee: number}[]>([]);

  // B2B Pre-filled settings from B2B Gate
  const [formData, setFormData] = useState({
    cnpj: '',
    restaurantName: '',
    buyerName: '',
    whatsapp: '',
    deliveryType: 'delivery' as 'delivery' | 'pickup',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    notes: ''
  });

  useEffect(() => {
    // Fill B2B settings
    const savedCnpj = localStorage.getItem('fishhouse_b2b_cnpj') || '';
    const savedWhatsapp = localStorage.getItem('fishhouse_b2b_whatsapp') || '';
    const savedName = localStorage.getItem('fishhouse_b2b_name') || '';

    setFormData(prev => ({
      ...prev,
      cnpj: savedCnpj,
      restaurantName: savedName,
      whatsapp: savedWhatsapp
    }));

    fetchDeliveryZones();
  }, []);

  const fetchDeliveryZones = async () => {
    const { data } = await supabase.from('delivery_zones').select('neighborhood_name, fee');
    if (data) setDeliveryZones(data);
  };

  // Allowed cities list (lowercase for comparison)
  const allowedCities = ['navegantes', 'penha', 'itajaí', 'balneário piçarras', 'piçarras', 'balneário camboriú', 'camboriú'];
  const isCityAllowed = !formData.city || allowedCities.includes(formData.city.toLowerCase().trim());

  // Filter delivery zones based on identified city
  const filteredZones = deliveryZones.filter(z => {
    const clientCity = (formData.city || '').toLowerCase().trim();
    if (!clientCity) return false;
    
    const zoneName = z.neighborhood_name.toLowerCase().trim();
    if (clientCity === 'navegantes') {
      const otherCities = ['penha', 'itajaí', 'piçarras', 'camboriú'];
      return !otherCities.some(city => zoneName.includes(city));
    } else {
      return zoneName.includes(clientCity);
    }
  });

  // Calculate dynamic shipping cost
  const matchedZone = deliveryZones.find(z => {
    const zoneName = z.neighborhood_name.toLowerCase().trim();
    const clientNeigh = formData.neighborhood.toLowerCase().trim();
    const clientCity = (formData.city || '').toLowerCase().trim();
    
    if (zoneName.includes(clientCity)) {
      return zoneName.includes(clientNeigh);
    }
    if (clientCity === 'navegantes') {
      return zoneName === clientNeigh;
    }
    return false;
  });
  const shippingCost = formData.deliveryType === 'delivery' 
    ? (isCityAllowed ? (matchedZone ? Number(matchedZone.fee) : (settings?.delivery_fee || 15.00)) : 0)
    : 0;
  
  const subtotal = cartTotal;
  const total = subtotal + shippingCost;

  useEffect(() => {
    if (items.length === 0 && currentStep !== 'success') {
      navigate('/atacado');
    }
  }, [items, currentStep, navigate]);

  const handleCEPBlur = async () => {
    const cep = formData.cep.replace(/\D/g, '');
    if (cep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            street: data.logradouro,
            neighborhood: data.bairro,
            city: data.localidade,
            state: data.uf
          }));
        }
      } catch (error) {
        console.error('Error fetching CEP:', error);
      }
    }
  };

  const handleConfirmOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || items.length === 0) return;

    if (!formData.restaurantName || !formData.cnpj || !formData.buyerName || !formData.whatsapp) {
      alert('Por favor, preencha todos os campos cadastrais.');
      return;
    }

    if (formData.deliveryType === 'delivery') {
      if (!formData.cep || !formData.street || !formData.number || !formData.neighborhood) {
        alert('Por favor, preencha o endereço completo para entrega.');
        return;
      }
      if (!isCityAllowed) {
        alert('Desculpe! No momento realizamos entregas apenas em Navegantes, Penha, Itajaí, Balneário Camboriú e Piçarras. Você pode escolher a opção "Retirada na Loja" para prosseguir com seu pedido.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // 1. Save the order in Supabase
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_name: formData.buyerName,
          customer_whatsapp: formData.whatsapp,
          delivery_type: formData.deliveryType,
          address_cep: formData.cep,
          address_street: formData.street,
          address_number: formData.number,
          address_complement: formData.complement,
          address_neighborhood: formData.neighborhood,
          address_city: formData.city,
          address_state: formData.state,
          payment_method: 'whatsapp_b2b',
          total_amount: subtotal,
          final_amount: total,
          payment_status: 'pending',
          order_status: 'pending',
          is_b2b: true,
          restaurant_cnpj: formData.cnpj,
          restaurant_name: formData.restaurantName
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Insert items into order_items
      const orderItems = items.map(item => ({
        order_id: order.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // 3. Generate beautifully structured WhatsApp Text Message
      const formattedItemsText = items.map(item => {
        const weightSuffix = item.unit === 'cx' ? ' (15kg)' : '';
        return `• ${item.quantity.toString().replace('.', ',')} ${item.unit || 'un'} x ${item.name}${weightSuffix} (R$ ${Number(item.price).toFixed(2).replace('.', ',')}/${item.unit || 'un'}) = *R$ ${Number(item.price * item.quantity).toFixed(2).replace('.', ',')}*`;
      }).join('\n');

      const addressText = formData.deliveryType === 'delivery'
        ? `${formData.street}, ${formData.number} ${formData.complement ? `- ${formData.complement}` : ''} - ${formData.neighborhood}, ${formData.city} - ${formData.state} (CEP: ${formData.cep})`
        : `Retirada na loja Fish House`;

      const orderMsg = 
`*FISH HOUSE PREMIUM - NOVO PEDIDO DE ATACADO (B2B) 🐟*

*DADOS DO CLIENTE:*
🏢 *Empresa:* ${formData.restaurantName}
📄 *CNPJ:* ${formData.cnpj}
👤 *Comprador:* ${formData.buyerName}
📞 *WhatsApp:* ${formData.whatsapp}

*ITENS SOLICITADOS:*
------------------------------------------------
${formattedItemsText}
------------------------------------------------
*Subtotal:* R$ ${Number(subtotal).toFixed(2).replace('.', ',')}
*Frete B2B:* R$ ${Number(shippingCost).toFixed(2).replace('.', ',')}
*Total Estimado:* *R$ ${Number(total).toFixed(2).replace('.', ',')}*

*TIPO DE ENTREGA:*
🚚 *Modo:* ${formData.deliveryType === 'delivery' ? 'Delivery / Entrega programada' : 'Retirada presencial'}
📍 *Endereço:* ${addressText}

${formData.notes ? `*Observações:* _"${formData.notes}"_\n` : ''}
---
Solicito aprovação cadastral e agendamento da entrega. Obrigado!`;

      // 4. Open WhatsApp Web/App
      const cleanPhone = (settings?.whatsapp_number || '554730114981').replace(/\D/g, '');
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(orderMsg)}`;
      
      setOrderNumber(order.id.slice(0, 8).toUpperCase());
      setCurrentStep('success');
      clearCart();

      // Trigger automatic WhatsApp redirect
      setTimeout(() => {
        window.open(waUrl, '_blank');
      }, 1000);

    } catch (error: any) {
      console.error(error);
      alert('Erro ao registrar o pedido de atacado: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="bg-ink-950 min-h-screen pt-32 pb-20 px-4">
      <div className="max-w-4xl mx-auto">
        
        {/* Back Link */}
        {currentStep === 'form' && (
          <button 
            onClick={() => navigate('/atacado')}
            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors mb-8"
          >
            <ChevronLeft className="w-4 h-4" /> Voltar ao Catálogo de Atacado
          </button>
        )}

        <AnimatePresence mode="wait">
          {currentStep === 'form' ? (
            <motion.div
              key="wholesale-form"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              
              {/* Form Column */}
              <form onSubmit={handleConfirmOrder} className="lg:col-span-2 space-y-6">
                
                {/* Cadastral Info Section */}
                <div className="bg-ink-900 border border-white/10 rounded-3xl p-6 md:p-8 space-y-6">
                  <h2 className="text-xl font-display font-bold text-white flex items-center gap-2.5 border-b border-white/5 pb-4">
                    <Building2 className="text-gold-500 w-5 h-5" /> Dados da Empresa & Comprador
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Razão Social</label>
                      <input 
                        type="text" 
                        required
                        value={formData.restaurantName}
                        onChange={e => setFormData({...formData, restaurantName: e.target.value})}
                        className="w-full bg-ink-950 border border-white/5 rounded-xl px-4 py-3.5 text-white focus:border-gold-500 outline-none transition-colors placeholder:text-gray-700"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">CNPJ</label>
                      <input 
                        type="text" 
                        required
                        value={formData.cnpj}
                        onChange={e => setFormData({...formData, cnpj: e.target.value})}
                        className="w-full bg-ink-950 border border-white/5 rounded-xl px-4 py-3.5 text-white focus:border-gold-500 outline-none transition-colors placeholder:text-gray-700 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Nome do Comprador / Responsável</label>
                      <input 
                        type="text" 
                        required
                        placeholder="Ex: Chef Carlos"
                        value={formData.buyerName}
                        onChange={e => setFormData({...formData, buyerName: e.target.value})}
                        className="w-full bg-ink-950 border border-white/5 rounded-xl px-4 py-3.5 text-white focus:border-gold-500 outline-none transition-colors placeholder:text-gray-700"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">WhatsApp Comercial</label>
                      <input 
                        type="text" 
                        required
                        value={formData.whatsapp}
                        onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                        className="w-full bg-ink-950 border border-white/5 rounded-xl px-4 py-3.5 text-white focus:border-gold-500 outline-none transition-colors placeholder:text-gray-700"
                      />
                    </div>
                  </div>
                </div>

                {/* Delivery Location Section */}
                <div className="bg-ink-900 border border-white/10 rounded-3xl p-6 md:p-8 space-y-6">
                  <h2 className="text-xl font-display font-bold text-white flex items-center gap-2.5 border-b border-white/5 pb-4">
                    <Truck className="text-gold-500 w-5 h-5" /> Local de Entrega B2B
                  </h2>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, deliveryType: 'delivery'})}
                      className={`flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all ${
                        formData.deliveryType === 'delivery' 
                        ? 'bg-gold-500/10 border-gold-500 text-gold-500' 
                        : 'bg-ink-950 border-white/5 text-gray-500 hover:border-white/20'
                      }`}
                    >
                      <Truck className="w-6 h-6" />
                      <span className="text-[10px] font-black uppercase tracking-wider">Entrega Programada</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, deliveryType: 'pickup'})}
                      className={`flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all ${
                        formData.deliveryType === 'pickup' 
                        ? 'bg-gold-500/10 border-gold-500 text-gold-500' 
                        : 'bg-ink-950 border-white/5 text-gray-500 hover:border-white/20'
                      }`}
                    >
                      <Store className="w-6 h-6" />
                      <span className="text-[10px] font-black uppercase tracking-wider">Retirar na Peixaria</span>
                    </button>
                  </div>

                  {formData.deliveryType === 'delivery' ? (
                    <div className="space-y-4">
                      {/* Cidades Atendidas Info Card */}
                      <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex gap-3 items-start">
                        <AlertCircle className="w-5 h-5 text-gold-500 shrink-0 mt-0.5" />
                        <div className="text-xs text-gray-400 leading-relaxed">
                          <span className="text-white font-bold block mb-1">Cidades Atendidas para Entrega:</span>
                          Navegantes, Penha, Itajaí, Balneário Camboriú e Piçarras.
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">CEP</label>
                          <input 
                            type="text" 
                            required
                            placeholder="00000-000"
                            value={formData.cep}
                            onBlur={handleCEPBlur}
                            onChange={e => setFormData({...formData, cep: e.target.value})}
                            className="w-full bg-ink-950 border border-white/5 rounded-xl px-4 py-3.5 text-white focus:border-gold-500 outline-none transition-colors placeholder:text-gray-700"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Bairro</label>
                          <input 
                            list="wholesale-neighborhoods"
                            type="text" 
                            required
                            placeholder="Ex: Centro"
                            value={formData.neighborhood}
                            onChange={e => setFormData({...formData, neighborhood: e.target.value})}
                            className="w-full bg-ink-950 border border-white/5 rounded-xl px-4 py-3.5 text-white focus:border-gold-500 outline-none transition-colors placeholder:text-gray-700"
                          />
                          <datalist id="wholesale-neighborhoods">
                            {filteredZones.map(z => (
                              <option key={z.neighborhood_name} value={z.neighborhood_name} />
                            ))}
                          </datalist>
                          {matchedZone && (
                            <p className="text-[8px] text-green-500 font-black uppercase tracking-widest ml-1 mt-1.5">✓ Taxa p/ este bairro: R$ {Number(matchedZone.fee).toFixed(2).replace('.', ',')}</p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Rua / Av.</label>
                        <input 
                          type="text" 
                          required
                          value={formData.street}
                          onChange={e => setFormData({...formData, street: e.target.value})}
                          className="w-full bg-ink-950 border border-white/5 rounded-xl px-4 py-3.5 text-white focus:border-gold-500 outline-none transition-colors"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Número</label>
                          <input 
                            type="text" 
                            required
                            value={formData.number}
                            onChange={e => setFormData({...formData, number: e.target.value})}
                            className="w-full bg-ink-950 border border-white/5 rounded-xl px-4 py-3.5 text-white focus:border-gold-500 outline-none transition-colors"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Complemento / Ref.</label>
                          <input 
                            type="text" 
                            placeholder="Sala, Andar, Ponto Ref."
                            value={formData.complement}
                            onChange={e => setFormData({...formData, complement: e.target.value})}
                            className="w-full bg-ink-950 border border-white/5 rounded-xl px-4 py-3.5 text-white focus:border-gold-500 outline-none transition-colors placeholder:text-gray-700"
                          />
                        </div>
                      </div>
                      {formData.cep.replace(/\D/g, '').length === 8 && formData.city && (
                        <div className="bg-ink-950/50 border border-white/5 rounded-2xl p-4 space-y-2">
                          <p className="text-xs text-gray-400">
                            Cidade identificada: <strong className="text-white">{formData.city} - {formData.state}</strong>
                          </p>
                          {!isCityAllowed && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                              ⚠️ Desculpe, não realizamos entregas nesta cidade. Atendemos apenas Navegantes, Penha, Itajaí, Balneário Camboriú e Piçarras.
                              <br />
                              Para continuar, por favor selecione <button type="button" onClick={() => setFormData({...formData, deliveryType: 'pickup'})} className="text-gold-400 font-bold underline ml-1 hover:text-gold-300">Retirada na Loja</button>.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white/5 p-5 rounded-2xl flex gap-3 border border-white/5">
                      <MapPin className="text-gold-500 shrink-0 w-5 h-5" />
                      <div className="text-sm">
                        <p className="text-white font-bold">Endereço para retirada:</p>
                        <p className="text-gray-400 mt-1 leading-relaxed">
                          {settings?.address_street}, {settings?.address_number} - {settings?.address_neighborhood}, {settings?.address_city} - SC
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Order special instructions */}
                  <div className="space-y-1 border-t border-white/5 pt-6 mt-4">
                    <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Instruções Especiais de Recebimento</label>
                    <textarea 
                      placeholder="Ex: Entregar apenas pelo canal B2B das 14h às 17h aos cuidados de Chef de Cozinha..."
                      value={formData.notes}
                      onChange={e => setFormData({...formData, notes: e.target.value})}
                      className="w-full bg-ink-950 border border-white/5 rounded-xl p-4 text-white focus:border-gold-500 outline-none transition-colors placeholder:text-gray-800 h-24 resize-none text-xs leading-relaxed"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gold-500 text-ink-950 font-bold uppercase tracking-widest text-xs py-5 rounded-2xl hover:bg-gold-400 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-2xl shadow-gold-500/10"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCcw className="w-4 h-4 animate-spin" /> Registrando Pedido...
                    </>
                  ) : (
                    <>
                      Enviar Pedido p/ WhatsApp B2B <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Order summary column */}
              <div className="bg-ink-900 border border-white/10 rounded-3xl p-6 md:p-8 space-y-6 h-fit sticky top-32">
                <h2 className="text-lg font-display font-bold text-white flex items-center gap-2 pb-4 border-b border-white/5">
                  <ShoppingBag className="text-gold-500 w-4 h-4" /> Resumo do Pedido B2B
                </h2>

                {/* Items list */}
                <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {items.map(item => (
                    <div key={item.id} className="flex justify-between items-start gap-4">
                      <div>
                        <p className="text-xs font-bold text-white line-clamp-1">{item.name}</p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
                          {item.quantity} {item.unit || 'un'} x R$ {Number(item.price).toFixed(2).replace('.', ',')}
                        </p>
                      </div>
                      <span className="text-xs font-black text-white shrink-0">R$ {Number(item.price * item.quantity).toFixed(2).replace('.', ',')}</span>
                    </div>
                  ))}
                </div>

                {/* Totals details */}
                <div className="border-t border-white/5 pt-4 space-y-2">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Subtotal</span>
                    <span>R$ {Number(subtotal).toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Taxa de Logística (B2B)</span>
                    <span>{shippingCost > 0 ? `R$ ${Number(shippingCost).toFixed(2).replace('.', ',')}` : 'Grátis'}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold text-white pt-2 border-t border-white/5">
                    <span>Valor Estimado</span>
                    <span className="text-gold-500 font-black text-lg">R$ {Number(total).toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>

                {/* B2B Checkout rules badge */}
                <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex gap-2">
                  <Clock className="text-gold-500 shrink-0 w-4 h-4 mt-0.5" />
                  <div className="text-[10px] text-gray-400 leading-relaxed font-bold uppercase tracking-wide">
                    ⚠️ PROCESSO B2B COMERCIAL:<br/>
                    Este pedido será analisado pelo setor comercial para faturamento corporativo direto. O contato será feito via WhatsApp.
                  </div>
                </div>
              </div>

            </motion.div>
          ) : (
            <motion.div
              key="wholesale-success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-ink-900 border border-white/10 rounded-[3rem] p-10 md:p-16 text-center space-y-8 max-w-xl mx-auto shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gold-500/5 rounded-full blur-[100px] pointer-events-none" />

              <div className="w-20 h-20 bg-green-500/10 border border-green-500/30 text-green-500 rounded-[2rem] flex items-center justify-center mx-auto shadow-xl shadow-green-500/10 animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-3">
                <p className="text-gold-500 text-[10px] font-black uppercase tracking-[0.25em]">Pedido B2B Gerado!</p>
                <h2 className="text-3xl font-display font-bold text-white">Obrigado pela preferência!</h2>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-mono">Pedido ID: #{orderNumber}</p>
              </div>

              <p className="text-gray-300 text-sm leading-relaxed max-w-sm mx-auto">
                Seu pedido foi registrado no sistema Fish House com sucesso! Estamos **redirecionando você para o WhatsApp** comercial para agendar a logística.
              </p>

              <div className="bg-ink-950 p-5 rounded-2xl border border-white/5 max-w-sm mx-auto">
                <p className="text-xs text-gray-400 font-medium">
                  Caso o redirecionamento não aconteça automaticamente, clique no botão comercial abaixo:
                </p>
                <button
                  onClick={() => {
                    const cleanPhone = (settings?.whatsapp_number || '554730114981').replace(/\D/g, '');
                    window.open(`https://wa.me/${cleanPhone}`, '_blank');
                  }}
                  className="bg-green-500 hover:bg-green-400 text-white font-bold uppercase tracking-widest text-[9px] py-3.5 px-6 rounded-xl mt-4 active:scale-95 transition-all w-full flex items-center justify-center gap-2"
                >
                  <Phone className="w-3.5 h-3.5" /> Abrir WhatsApp Comercial
                </button>
              </div>

              <button
                onClick={() => navigate('/atacado')}
                className="text-gray-400 hover:text-white font-bold uppercase tracking-widest text-[10px] transition-colors"
              >
                Voltar ao Catálogo de Atacado
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
