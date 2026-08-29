import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  MapPin, 
  CreditCard, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  ShoppingBag, 
  Truck, 
  Store,
  QrCode,
  PackageCheck,
  RefreshCcw,
  AlertCircle,
  Clock,
  ArrowLeft,
  Moon
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSettings } from '../hooks/useSettings';

type Step = 'info' | 'payment' | 'success';

interface PaymentData {
  qr_code: string;
  qr_code_base64: string;
  payment_id: string;
}

export default function Checkout() {
  const { items, cartTotal, clearCart } = useCart();
  const navigate = useNavigate();
  const { settings, loading: settingsLoading } = useSettings();
  const [deliveryZones, setDeliveryZones] = useState<{neighborhood_name: string, fee: number}[]>([]);
  
  const [currentStep, setCurrentStep] = useState<Step>('info');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [cardBrickController, setCardBrickController] = useState<any>(null);
  const [storeOpen, setStoreOpen] = useState(true);

  useEffect(() => {
    if (!settings) return;
    
    const checkStatus = () => {
      const now = new Date();
      const day = now.getDay();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const currentTimeInMinutes = hours * 60 + minutes;
      const dateStr = now.toISOString().split('T')[0];

      // 1. Check for Special Dates (Holidays)
      const specialDate = settings.special_dates?.find(s => s.date === dateStr);
      
      if (specialDate) {
        if (specialDate.closed) {
          setStoreOpen(false);
          return;
        }
        const [oH, oM] = specialDate.open.split(':').map(Number);
        const [cH, cM] = specialDate.close.split(':').map(Number);
        setStoreOpen(currentTimeInMinutes >= (oH * 60 + oM) && currentTimeInMinutes < (cH * 60 + cM));
        return;
      }

      // 2. Fallback to weekly schedule
      const todaySchedules = settings.opening_hours.find(s => s.day === day);
      if (!todaySchedules || todaySchedules.closed) {
        setStoreOpen(false);
        return;
      }

      const [oH, oM] = todaySchedules.open.split(':').map(Number);
      const [cH, cM] = todaySchedules.close.split(':').map(Number);
      
      setStoreOpen(currentTimeInMinutes >= (oH * 60 + oM) && currentTimeInMinutes < (cH * 60 + cM));
    };

    checkStatus();
    fetchDeliveryZones();
    const interval = setInterval(checkStatus, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [settings]);

  const fetchDeliveryZones = async () => {
    const { data } = await supabase.from('delivery_zones').select('neighborhood_name, fee');
    if (data) setDeliveryZones(data);
  };
  
  const [formData, setFormData] = useState({
    name: '',
    whatsapp: '',
    email: '',
    deliveryType: 'delivery' as 'delivery' | 'pickup',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    paymentMethod: 'pix' as 'pix' | 'credit_card'
  });

  // Set initial payment method based on settings
  useEffect(() => {
    if (settings) {
      if (settings.pix_enabled) {
        setFormData(prev => ({ ...prev, paymentMethod: 'pix' }));
      } else if (settings.credit_card_enabled) {
        setFormData(prev => ({ ...prev, paymentMethod: 'credit_card' }));
      }
    }
  }, [settings]);

  const pixDiscount = settings?.pix_discount_enabled ? (settings.pix_discount_percent / 100) : 0;
  
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
  const discount = formData.paymentMethod === 'pix' ? subtotal * pixDiscount : 0;
  const total = subtotal - discount + shippingCost;

  useEffect(() => {
    if (items.length === 0 && currentStep !== 'success') {
      navigate('/catalogo');
    }
  }, [items, currentStep, navigate]);

  // Realtime listener and polling fallback for payment status
  useEffect(() => {
    if (!orderId) return;

    let isSubscribed = true;

    // 1. Realtime listener
    const channel = supabase
      .channel(`order_status_${orderId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'orders',
        filter: `id=eq.${orderId}`
      }, (payload) => {
        if (payload.new.payment_status === 'paid' && isSubscribed) {
          setIsPaid(true);
          setCurrentStep('success');
          clearCart();
        }
      })
      .subscribe();

    // 2. Polling fallback (runs every 3 seconds)
    const checkPaymentStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('payment_status')
          .eq('id', orderId)
          .single();

        if (data && data.payment_status === 'paid' && isSubscribed) {
          setIsPaid(true);
          setCurrentStep('success');
          clearCart();
        }
      } catch (err) {
        console.error('Error polling payment status:', err);
      }
    };

    const pollInterval = setInterval(() => {
      if (!isPaid) checkPaymentStatus();
    }, 6000);

    return () => {
      isSubscribed = false;
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [orderId, clearCart]);

  // Handle Card Brick Initialization
  useEffect(() => {
    const mpPublicKey = settings?.mercadopago_public_key || 'APP_USR-66955474-abdc-4811-a356-c82f7c9abe37';
    if (formData.paymentMethod === 'credit_card' && currentStep === 'payment' && !cardBrickController && mpPublicKey) {
      try {
        const mp = new (window as any).MercadoPago(mpPublicKey, {
          locale: 'pt-BR'
        });
        const bricksBuilder = mp.bricks();

        const renderCardPaymentBrick = async (bricksBuilder: any) => {
        const settings = {
          initialization: {
            amount: total, // Usando o total final (com frete)
            payer: {
              email: formData.email || 'contato@fishhouse.com.br',
            },
          },
          customization: {
            visual: {
              style: {
                theme: 'dark',
                customVariables: {
                  formBackgroundColor: '#020617',
                  baseColor: '#cf9c4a'
                }
              },
            },
            paymentMethods: {
              maxInstallments: 12,
            }
          },
          callbacks: {
            onReady: () => {
              // Brick is ready
            },
            onSubmit: async (cardFormData: any) => {
              return new Promise((resolve, reject) => {
                handleSubmitCardOrder(cardFormData, resolve, reject);
              });
            },
            onError: (error: any) => {
              console.error(error);
            },
          },
        };
        const controller = await bricksBuilder.create('cardPayment', 'cardPaymentBrick_container', settings);
        setCardBrickController(controller);
      };

      renderCardPaymentBrick(bricksBuilder);
      } catch (err) {
        console.error('Card Brick init error:', err);
      }
    }
  }, [formData.paymentMethod, currentStep, total, formData.email, cardBrickController]);

  const handleSubmitCardOrder = async (cardFormData: any, resolve: any, reject: any) => {
    setIsSubmitting(true);
    try {
      // 1. Create order in Supabase first
      const order = await createOrder();
      if (!order) throw new Error('Falha ao criar pedido');

      // 2. Process with Edge Function
      const cardTotalRounded = Number(total.toFixed(2));
      const { data, error } = await supabase.functions.invoke('process-payment', {
        body: {
          orderId: order.id,
          amount: cardTotalRounded,
          paymentMethod: cardFormData.payment_method_id,
          token: cardFormData.token,
          installments: cardFormData.installments,
          issuerId: cardFormData.issuer_id,
          email: formData.email || cardFormData.payer?.email,
          firstName: formData.name,
          payer: cardFormData.payer
        }
      });

      if (error || !data.success) throw new Error(data.error || 'Erro no pagamento');

      setOrderId(order.id);
      
      if (data.status === 'approved') {
        setIsPaid(true);
        setCurrentStep('success');
        clearCart();
        resolve();
      } else {
        // Handle pending/other statuses
        alert('Pagamento em processamento. Aguarde a confirmação por e-mail.');
        setCurrentStep('success');
        clearCart();
        resolve();
      }
    } catch (e) {
      console.error(e);
      alert('Houve um erro com seu pagamento: ' + (e as Error).message);
      reject();
    } finally {
      setIsSubmitting(false);
    }
  };

  const createOrder = async () => {
    // Shared order creation logic
    // The variables 'total', 'discount', and 'shippingCost' are already calculated in the component scope
    
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_name: formData.name,
        customer_whatsapp: formData.whatsapp,
        customer_email: formData.email,
        delivery_type: formData.deliveryType,
        address_cep: formData.cep,
        address_street: formData.street,
        address_number: formData.number,
        address_complement: formData.complement,
        address_neighborhood: formData.neighborhood,
        address_city: formData.city,
        address_state: formData.state,
        payment_method: formData.paymentMethod,
        total_amount: cartTotal,
        final_amount: total,
        payment_status: 'pending',
        order_status: 'pending',
        scheduled: !storeOpen
      })
      .select()
      .single();

    if (orderError) throw orderError;

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

    // Trigger WhatsApp notifications
    try {
      import('../utils/whatsapp').then(async ({ notifyClientStatusChange, notifyStoreGroup }) => {
        // Notify Client
        await notifyClientStatusChange(order);

        // Map items to format expected by the WhatsApp message
        const mappedItems = items.map(item => ({
          product_name: item.name,
          quantity: item.quantity
        }));

        // Notify Store Group
        await notifyStoreGroup(order, mappedItems, 'new_order');
      }).catch(err => console.error('WhatsApp notification error:', err));
    } catch (err) {
      console.error('Error sending new order WhatsApp notification:', err);
    }

    return order;
  };

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

  const handleSubmitOrder = async () => {
    if (isSubmitting || items.length === 0) return;
    setIsSubmitting(true);
    try {
      // Clear any previous error or data
      setPaymentData(null);
      
      // 1. Create order in Supabase first
      const order = await createOrder();
      if (!order) throw new Error('Não foi possível registrar o pedido.');
      
      setOrderId(order.id);
      const pixTotal = Number(total.toFixed(2)); 
      
      const activeGateway = settings?.active_payment_gateway || 'mercadopago';
      const edgeFunctionName = activeGateway === 'pagbank' ? 'process-pagbank-payment' : 'process-payment';

      const { data: payData, error: payError } = await supabase.functions.invoke(edgeFunctionName, {
        body: {
          orderId: order.id,
          amount: pixTotal,
          paymentMethod: 'pix',
          email: formData.email || 'contato@fishhouse.com.br',
          firstName: formData.name
        }
      });

      let payResult = payData;
      let payErr = payError;

      // Fallback Infalível: Se a Edge Function do Supabase falhar, chama a API do Mercado Pago diretamente do cliente
      if (payErr || !payResult?.success) {
        const mpAccessToken = settings?.mercadopago_access_token || 'APP_USR-8761296159637536-040412-9318f41367f6a8ad10a37705d784b308-3009643047';
        if ((activeGateway === 'mercadopago' || !settings?.active_payment_gateway) && mpAccessToken) {
          try {
            console.warn('Executando fallback de comunicação direta com a API do Mercado Pago...');
            const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${mpAccessToken}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': order.id
              },
              body: JSON.stringify({
                transaction_amount: pixTotal,
                description: `Fish House - Pedido #${order.id.slice(0, 8).toUpperCase()}`,
                payment_method_id: 'pix',
                payer: {
                  email: formData.email || 'contato@fishhouse.com.br',
                  first_name: formData.name || 'Cliente',
                  last_name: 'Premium'
                }
              })
            });

            if (mpRes.ok) {
              const mpData = await mpRes.json();
              payResult = {
                success: true,
                payment_id: mpData.id,
                qr_code: mpData.point_of_interaction?.transaction_data?.qr_code,
                qr_code_base64: mpData.point_of_interaction?.transaction_data?.qr_code_base64
              };
              payErr = null;
              await supabase.from('orders').update({ mp_payment_id: mpData.id?.toString() }).eq('id', order.id);
            } else {
              const errBody = await mpRes.json();
              const msg = errBody.cause?.[0]?.description || errBody.message || 'Erro de autorização no Mercado Pago';
              payResult = { success: false, error: msg };
            }
          } catch (directErr: any) {
            console.error('Direct MP API fallback error:', directErr);
          }
        }
      }

      if (payErr || !payResult?.success) {
        const errorMsg = payResult?.error || 'Erro ao comunicar com o gateway de pagamento.';
        console.error('PIX Error:', payErr || errorMsg);
        alert(`❌ Erro no Pagamento (${activeGateway === 'pagbank' ? 'PagBank' : 'Mercado Pago'}): ${errorMsg}\n\nPor favor, tente novamente ou nos chame no WhatsApp.`);
        await supabase.from('orders').delete().eq('id', order.id);
        setIsSubmitting(false);
        return;
      }

      if (payResult.success) {
        setPaymentData({
          qr_code: payResult.qr_code,
          qr_code_base64: payResult.qr_code_base64,
          payment_id: payResult.payment_id || payResult.pagbank_order_id
        });
      }
    } catch (error) {
      console.error('Order Error:', error);
      alert('Erro ao processar pedido. Verifique os dados e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { id: 'info', name: 'Dados & Entrega', icon: User },
    { id: 'payment', name: 'Pagamento', icon: CreditCard },
    { id: 'success', name: 'Confirmação', icon: CheckCircle2 }
  ];

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 bg-ink-950">
      <div className="max-w-4xl mx-auto">
        {/* Success Banner if closed */}
        {!storeOpen && currentStep !== 'success' && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 bg-gold-500/10 border border-gold-500/20 rounded-3xl flex items-center gap-4 shadow-xl"
          >
            <div className="bg-gold-500 p-3 rounded-2xl shrink-0">
              <Moon className="w-6 h-6 text-ink-950" />
            </div>
            <div>
              <p className="text-gold-500 font-black uppercase tracking-widest text-[10px] mb-1">Loja Fechada Agora 🌙</p>
              <p className="text-white text-sm font-medium leading-relaxed">
                Estamos descansando, mas você pode garantir seu peixe fresco agora! Seu pedido será <span className="text-gold-500 font-bold underline">separado e agendado para amanhã, a partir das 08:30</span>. 🐟✨
              </p>
            </div>
          </motion.div>
        )}

        {/* Progress Bar */}
        <div className="flex items-center justify-between mb-12 relative">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/5 -translate-y-1/2 z-0" />
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isCompleted = steps.findIndex(s => s.id === currentStep) > idx;
            const isActive = step.id === currentStep;
            
            return (
              <div key={step.id} className="relative z-10 flex flex-col items-center">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                    isActive ? 'bg-gold-500 text-ink-950 scale-110 shadow-[0_0_15px_rgba(207,161,74,0.5)]' : 
                    isCompleted ? 'bg-green-500 text-white' : 'bg-ink-800 text-gray-500'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <Icon className="w-5 h-5" />}
                </div>
                <span className={`text-xs mt-2 font-medium ${isActive ? 'text-gold-500' : 'text-gray-500'}`}>
                  {step.name}
                </span>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <AnimatePresence mode="wait">
              {currentStep === 'info' && (
                <motion.div
                  key="step-info"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-ink-900 border border-white/10 rounded-3xl p-6 md:p-8 space-y-8"
                >
                  <div>
                    <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-2">
                      <User className="text-gold-500" /> Seus Dados
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-sm text-gray-400 ml-1">Nome Completo</label>
                        <input 
                          type="text" 
                          value={formData.name}
                          onChange={e => setFormData({...formData, name: e.target.value})}
                          className="w-full bg-ink-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold-500/50 transition-colors"
                          placeholder="Como você prefere ser chamado?"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm text-gray-400 ml-1">WhatsApp</label>
                        <input 
                          type="text" 
                          value={formData.whatsapp}
                          onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                          className="w-full bg-ink-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold-500/50 transition-colors"
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-2">
                      <Truck className="text-gold-500" /> Entrega
                    </h2>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <button
                        onClick={() => setFormData({...formData, deliveryType: 'delivery'})}
                        className={`flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all ${
                          formData.deliveryType === 'delivery' 
                          ? 'bg-gold-500/10 border-gold-500 text-gold-500' 
                          : 'bg-ink-800 border-white/5 text-gray-400 hover:border-white/20'
                        }`}
                      >
                        <Truck className="w-6 h-6" />
                        <span className="font-semibold">Delivery</span>
                      </button>
                      <button
                        onClick={() => setFormData({...formData, deliveryType: 'pickup'})}
                        className={`flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all ${
                          formData.deliveryType === 'pickup' 
                          ? 'bg-gold-500/10 border-gold-500 text-gold-500' 
                          : 'bg-ink-800 border-white/5 text-gray-400 hover:border-white/20'
                        }`}
                      >
                        <Store className="w-6 h-6" />
                        <span className="font-semibold">Retirada</span>
                      </button>
                    </div>

                    {formData.deliveryType === 'delivery' && (
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
                            <label className="text-sm text-gray-400 ml-1">CEP</label>
                            <input 
                              type="text" 
                              value={formData.cep}
                              onBlur={handleCEPBlur}
                              onChange={e => setFormData({...formData, cep: e.target.value})}
                              className="w-full bg-ink-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold-500/50 transition-colors"
                              placeholder="00000-000"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm text-gray-400 ml-1">Bairro</label>
                            <input 
                              list="neighborhoods"
                              type="text" 
                              value={formData.neighborhood}
                              onChange={e => setFormData({...formData, neighborhood: e.target.value})}
                              className="w-full bg-ink-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold-500/50 transition-colors"
                              placeholder="Ex: Centro"
                            />
                            <datalist id="neighborhoods">
                              {filteredZones.map(z => (
                                <option key={z.neighborhood_name} value={z.neighborhood_name} />
                              ))}
                            </datalist>
                            {matchedZone && (
                              <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest ml-1 mt-1">✓ Taxa p/ este bairro: R$ {Number(matchedZone.fee).toFixed(2).replace('.', ',')}</p>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm text-gray-400 ml-1">Rua / Logradouro</label>
                          <input 
                            type="text" 
                            value={formData.street}
                            onChange={e => setFormData({...formData, street: e.target.value})}
                            className="w-full bg-ink-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold-500/50 transition-colors"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-sm text-gray-400 ml-1">Número</label>
                            <input 
                              type="text" 
                              value={formData.number}
                              onChange={e => setFormData({...formData, number: e.target.value})}
                              className="w-full bg-ink-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold-500/50 transition-colors"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm text-gray-400 ml-1">Complemento</label>
                            <input 
                              type="text" 
                              value={formData.complement}
                              onChange={e => setFormData({...formData, complement: e.target.value})}
                              className="w-full bg-ink-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold-500/50 transition-colors"
                              placeholder="Apt, Sala, etc."
                            />
                          </div>
                        </div>
                        {formData.cep.replace(/\D/g, '').length === 8 && formData.city && (
                          <div className="bg-ink-800/50 border border-white/5 rounded-2xl p-4 space-y-2">
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
                    )}

                    {formData.deliveryType === 'pickup' && (
                      <div className="bg-gold-500/10 border border-gold-500/30 p-5 rounded-2xl space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="bg-gold-500 p-2.5 rounded-xl text-ink-950 shrink-0 mt-0.5 shadow-md">
                            <MapPin className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-white font-bold text-base">Local de Retirada na Loja Física:</p>
                            <p className="text-gold-400 text-sm font-semibold mt-1">
                              {settings?.address_street || 'Rua Pref. Juvenal Mafra'}, {settings?.address_number || '42'} - {settings?.address_neighborhood || 'Centro'}, {settings?.address_city || 'Navegantes'} - SC
                            </p>
                            <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                              Horário de Retirada: Segunda a Sábado das 08:30 às 19:30. Seu pedido será preparado imediatamente após a confirmação.
                            </p>
                          </div>
                        </div>

                        {/* Botão de Navegação GPS / Maps */}
                        <div className="pt-2 border-t border-white/10 flex flex-wrap gap-3">
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                              `${settings?.address_street || 'Rua Pref. Juvenal Mafra'}, ${settings?.address_number || '42'} - ${settings?.address_neighborhood || 'Centro'}, ${settings?.address_city || 'Navegantes'} - SC`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-ink-950 font-black px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg"
                          >
                            📍 Abrir no GPS / Google Maps
                          </a>
                          <a
                            href={`https://waze.com/ul?q=${encodeURIComponent(
                              `${settings?.address_street || 'Rua Pref. Juvenal Mafra'} ${settings?.address_number || '42'} Navegantes SC`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all border border-white/10"
                          >
                            🚙 Abrir no Waze
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      onClick={() => {
                        if (!formData.name || !formData.whatsapp) {
                          alert('Por favor, preencha seu nome e WhatsApp');
                          return;
                        }
                        if (formData.deliveryType === 'delivery') {
                          if (!formData.cep || !formData.number) {
                            alert('Por favor, preencha os dados de entrega');
                            return;
                          }
                          if (!isCityAllowed) {
                            alert('Desculpe! No momento realizamos entregas apenas em Navegantes, Penha, Itajaí, Balneário Camboriú e Piçarras. Você pode escolher a opção "Retirada na Loja" para prosseguir com seu pedido.');
                            return;
                          }
                        }
                        setPaymentData(null); // Reset PIX data if coming back
                        setCurrentStep('payment');
                      }}
                      className="flex items-center gap-2 bg-gradient-to-r from-gold-400 to-gold-600 text-ink-950 px-8 py-4 rounded-xl font-bold hover:from-gold-300 hover:to-gold-500 transition-all shadow-[0_0_20px_rgba(207,161,74,0.3)]"
                    >
                      Continuar para Pagamento <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              )}

              {currentStep === 'payment' && (
                <motion.div
                  key="step-payment"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-ink-900 border border-white/10 rounded-3xl p-6 md:p-8 space-y-8"
                >
                  <div>
                    <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-2">
                      <CreditCard className="text-gold-500" /> Forma de Pagamento
                    </h2>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {(settings?.pix_enabled !== false) && (
                        <button
                          type="button"
                          onClick={() => setFormData({...formData, paymentMethod: 'pix'})}
                          className={`w-full flex items-center justify-between p-6 rounded-2xl border transition-all ${
                            formData.paymentMethod === 'pix' 
                            ? 'bg-gold-500/10 border-gold-500 text-gold-500 shadow-lg shadow-gold-500/10' 
                            : 'bg-ink-800 border-white/5 text-gray-400 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <QrCode className="w-8 h-8" />
                            <div className="text-left">
                              <p className="font-bold text-lg">PIX</p>
                              {settings?.pix_discount_enabled && (
                                <p className="text-xs text-green-500 font-semibold uppercase">{settings.pix_discount_percent}% off</p>
                              )}
                            </div>
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${formData.paymentMethod === 'pix' ? 'border-gold-500' : 'border-white/10'}`}>
                            {formData.paymentMethod === 'pix' && <div className="w-3 h-3 bg-gold-500 rounded-full" />}
                          </div>
                        </button>
                      )}

                      {(settings?.credit_card_enabled !== false) && (
                        <button
                          type="button"
                          onClick={() => setFormData({...formData, paymentMethod: 'credit_card'})}
                          className={`w-full flex items-center justify-between p-6 rounded-2xl border transition-all ${
                            formData.paymentMethod === 'credit_card' 
                            ? 'bg-gold-500/10 border-gold-500 text-gold-500 shadow-lg shadow-gold-500/10' 
                            : 'bg-ink-800 border-white/5 text-gray-400 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <CreditCard className="w-8 h-8" />
                            <div className="text-left">
                              <p className="font-bold text-lg">Cartão de Crédito</p>
                            </div>
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${formData.paymentMethod === 'credit_card' ? 'border-gold-500' : 'border-white/10'}`}>
                            {formData.paymentMethod === 'credit_card' && <div className="w-3 h-3 bg-gold-500 rounded-full" />}
                          </div>
                        </button>
                      )}
                    </div>
                  </div>

                  {formData.paymentMethod === 'pix' && (
                    <div className="bg-ink-950 p-6 rounded-2xl border border-white/5 space-y-6">
                      {!paymentData ? (
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-gold-500 mt-1 shrink-0" />
                          <p className="text-sm text-gray-400">
                            Ao finalizar, você receberá o QR Code e o código Pix Copia e Cola. O pedido é processado imediatamente após a confirmação do pagamento.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-center space-y-4">
                          <div className="p-4 bg-white rounded-2xl">
                            <img 
                              src={`data:image/png;base64,${paymentData.qr_code_base64}`} 
                              alt="PIX QR Code" 
                              className="w-48 h-48"
                            />
                          </div>
                          
                          <div className="space-y-2 w-full">
                            <p className="text-xs text-gold-500 font-bold uppercase tracking-widest">Código Pix Copia e Cola</p>
                            <div className="flex items-center gap-2 bg-ink-900 border border-white/10 p-3 rounded-xl">
                              <input 
                                readOnly 
                                value={paymentData.qr_code}
                                className="bg-transparent border-none text-xs text-gray-400 flex-1 focus:outline-none overflow-hidden"
                              />
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(paymentData.qr_code);
                                  alert('Código copiado!');
                                }}
                                className="bg-gold-500 text-ink-950 px-3 py-1 rounded-lg text-xs font-bold"
                              >
                                Copiar
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-gold-500 animate-pulse text-sm font-medium">
                            <RefreshCcw className="w-4 h-4" /> Aguardando pagamento...
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {formData.paymentMethod === 'credit_card' && (
                    <div className="bg-ink-950 p-6 rounded-2xl border border-white/5 space-y-4">
                      <div id="cardPaymentBrick_container"></div>
                      <p className="text-[10px] text-gray-500 text-center uppercase tracking-widest font-bold">Ambiente Criptografado e Seguro</p>
                    </div>
                  )}

                  <div className="flex gap-4 pt-4">
                    <button
                      onClick={() => {
                        if (paymentData) {
                          if (confirm('Deseja cancelar este pagamento e voltar?')) {
                            setPaymentData(null);
                          } else {
                            return;
                          }
                        }
                        setCurrentStep('info');
                      }}
                      className="flex items-center justify-center gap-2 bg-white/5 text-white px-6 py-4 rounded-xl font-bold hover:bg-white/10 transition-all border border-white/10"
                    >
                      <ChevronLeft className="w-5 h-5" /> Voltar
                    </button>
                    
                    {!paymentData && formData.paymentMethod === 'pix' && (
                      <button
                        onClick={handleSubmitOrder}
                        disabled={isSubmitting}
                        className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-gold-400 to-gold-600 text-ink-950 px-8 py-4 rounded-xl font-bold hover:from-gold-300 hover:to-gold-500 transition-all shadow-[0_0_20px_rgba(207,161,74,0.3)] disabled:opacity-50"
                      >
                        {isSubmitting ? 'Gerando PIX...' : 'Pagar com PIX'} <PackageCheck className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </motion.div>
              )}

              {currentStep === 'success' && (
                <motion.div
                  key="step-success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-ink-900 border border-white/10 rounded-3xl p-8 md:p-12 text-center space-y-8"
                >
                  <div className="w-24 h-24 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-12 h-12" />
                  </div>
                  
                  <div className="space-y-2">
                    <h2 className="text-3xl md:text-4xl font-display font-bold text-white">Pedido Recebido!</h2>
                    <p className="text-gray-400 text-lg">Seu pedido foi registrado com sucesso e já estamos cuidando de tudo.</p>
                  </div>

                  <div className="bg-ink-950 p-6 rounded-2xl border border-white/5 inline-block min-w-[280px]">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Número do Pedido</p>
                    <p className="text-xl font-mono font-bold text-gold-500">{orderId?.slice(0, 8).toUpperCase()}</p>
                  </div>

                  <div className="space-y-4 pt-6">
                    <button
                      onClick={() => navigate('/')}
                      className="w-full max-w-sm bg-gradient-to-r from-gold-400 to-gold-600 text-ink-950 py-4 rounded-xl font-bold hover:from-gold-300 hover:to-gold-500 transition-all shadow-[0_0_20px_rgba(207,161,74,0.3)]"
                    >
                      Acompanhar Pedido no WhatsApp
                    </button>
                    <button
                      onClick={() => navigate('/')}
                      className="w-full max-w-sm bg-transparent text-gray-400 py-4 font-semibold hover:text-white transition-colors"
                    >
                      Voltar para a Página Inicial
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sidebar Summary */}
          <div className="lg:col-span-1">
            <div className="bg-ink-900 border border-white/10 rounded-3xl p-6 sticky top-28">
              <h3 className="text-xl font-display font-bold text-white mb-6 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-gold-500" /> Resumo
              </h3>
              
              <div className="space-y-4 mb-6">
                {items.map(item => (
                  <div key={item.id} className="flex justify-between text-sm items-start gap-4">
                    <span className="text-gray-400 flex-1">
                      <span className="text-white font-bold">{item.quantity.toString().replace('.', ',')}{item.unit || 'un'}</span> {item.name}
                    </span>
                    <span className="text-white font-medium whitespace-nowrap">R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-3 pt-4 border-t border-white/5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Subtotal</span>
                  <span className="text-white">R$ {subtotal.toFixed(2).replace('.', ',')}</span>
                </div>
                
                {formData.paymentMethod === 'pix' && settings?.pix_discount_enabled && (
                  <div className="flex justify-between text-sm text-green-500">
                    <span>Desconto PIX ({settings.pix_discount_percent}%)</span>
                    <span>- R$ {discount.toFixed(2).replace('.', ',')}</span>
                  </div>
                )}
                
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Frete</span>
                  <span className="text-white">
                    {shippingCost === 0 ? 'Grátis' : `R$ ${shippingCost.toFixed(2).replace('.', ',')}`}
                  </span>
                </div>

                <div className="flex justify-between text-xl font-bold pt-4 text-white font-display">
                  <span>Total</span>
                  <span className="text-gold-500">R$ {total.toFixed(2).replace('.', ',')}</span>
                </div>
              </div>

              {!storeOpen && (
                <div className="mt-6 bg-amber-500/10 p-4 rounded-xl border border-amber-500/20 flex gap-3">
                  <Clock className="w-5 h-5 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-500/80">Loja Fechada Agora - Seu pedido será agendado para amanhã, a partir das 08:30</p>
                </div>
              )}

              {currentStep === 'info' && (
                <div className="mt-6 p-4 rounded-xl bg-gold-500/5 border border-gold-500/10 flex gap-3 text-xs text-gray-400">
                  <AlertCircle className="w-4 h-4 text-gold-500 shrink-0" />
                  <p>O prazo médio de entrega para sua região é de 45 a 60 minutos.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
