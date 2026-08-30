import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Clock, 
  MapPin, 
  MessageCircle, 
  Tag, 
  Trash2, 
  Plus, 
  Save, 
  RefreshCcw, 
  Globe, 
  Printer, 
  ShieldCheck, 
  AlertCircle,
  Smartphone,
  Mail,
  FileText,
  BarChart3,
  Code2,
  Trash,
  Truck,
  CreditCard,
  CheckCircle2,
  QrCode,
  Barcode,
  Monitor,
  Edit2,
  Check,
  HardDrive,
  CloudUpload,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { localDb } from '../services/local/localDb';
import { syncEngine } from '../services/local/syncEngine';

type OpeningHour = {
  day: number;
  open: string;
  close: string;
  closed: boolean;
};

type SpecialDate = {
  date: string;
  open: string;
  close: string;
  closed: boolean;
  label: string;
};

type SiteSettings = {
  id: string;
  store_name: string;
  cnpj: string;
  whatsapp: string;
  contact_email: string;
  contact_phone: string;
  delivery_fee: number;
  address_street: string;
  address_number: string;
  address_neighborhood: string;
  address_city: string;
  opening_hours: OpeningHour[];
  special_dates: SpecialDate[];
  tracking_gtm: string;
  tracking_pixel: string;
  tracking_gads: string;
  label_config: { header: string; footer: string };
  categories: string[];
  mercadopago_enabled: boolean;
  mercadopago_public_key: string;
  mercadopago_access_token: string;
  active_payment_gateway?: 'mercadopago' | 'pagbank';
  pagbank_enabled?: boolean;
  pagbank_environment?: 'sandbox' | 'producao';
  pagbank_token?: string;
  pagbank_public_key?: string;
  pix_discount_enabled: boolean;
  pix_discount_percent: number;
  credit_card_enabled: boolean;
  pix_enabled: boolean;
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
  nfe_io_api_key?: string;
  nfe_io_company_id?: string;
  nfe_io_service_code?: string;
  nfe_io_environment?: 'homologacao' | 'producao';
  wholesale_discount_type?: string;
  wholesale_discount_value?: number;
};

type DeliveryZone = {
  id: string;
  neighborhood_name: string;
  fee: number;
};

export default function AdminSettings() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'schedule' | 'catalog' | 'delivery' | 'tracking' | 'payment' | 'whatsapp' | 'printer' | 'fiscal' | 'scale' | 'desktop'>('general');
  const [testNumber, setTestNumber] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newZone, setNewZone] = useState({ neighborhood_name: '', fee: 0 });
  const [newSpecialDate, setNewSpecialDate] = useState<SpecialDate>({
    date: '',
    open: '09:00',
    close: '18:00',
    closed: false,
    label: ''
  });
  const [editingSpecialDateIdx, setEditingSpecialDateIdx] = useState<number | null>(null);

  // Scale & Tara states
  const [taras, setTaras] = useState<any[]>([]);
  const [tarasLoading, setTarasLoading] = useState(false);
  const [isTaraModalOpen, setIsTaraModalOpen] = useState(false);
  const [editingTara, setEditingTara] = useState<any | null>(null);
  const [taraForm, setTaraForm] = useState({ codigo: '', peso: '', descricao: '' });
  const [deptoCode, setDeptoCode] = useState('01');
  const [deptoName, setDeptoName] = useState('PEIXARIA');
  const [barcodeType, setBarcodeType] = useState(() => localStorage.getItem('scale_barcode_type') || 'price');

  const daysLabels = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  useEffect(() => {
    fetchSettings();
    fetchDeliveryZones();
  }, []);

  const [desktopRelease, setDesktopRelease] = useState<{ version: string; downloadUrl: string; sizeMb: string } | null>(null);
  const [desktopLoading, setDesktopLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'scale') {
      fetchTaras();
    }
    if (activeTab === 'desktop') {
      fetchDesktopRelease();
    }
  }, [activeTab]);

  const fetchDesktopRelease = async () => {
    setDesktopLoading(true);
    try {
      const res = await fetch('https://api.github.com/repos/williandaviny/fish-house-desktop/releases/latest');
      if (res.ok) {
        const data = await res.json();
        const asset = data.assets?.find((a: any) => a.name.endsWith('.exe') || a.name.endsWith('.msi'));
        const size = asset ? (asset.size / (1024 * 1024)).toFixed(1) + ' MB' : '~5.4 MB';
        setDesktopRelease({
          version: data.tag_name || '1.0.0',
          downloadUrl: asset?.browser_download_url || data.html_url || 'https://github.com/williandaviny/fish-house-desktop/releases',
          sizeMb: size
        });
      }
    } catch (e) {
      console.error('Erro ao buscar release desktop:', e);
    } finally {
      setDesktopLoading(false);
    }
  };

  const fetchTaras = async () => {
    setTarasLoading(true);
    try {
      const { data, error } = await supabase.from('taras_balanca').select('id, codigo, descricao, peso').order('codigo');
      if (!error && data) setTaras(data);
    } catch (e) {
      console.error(e);
    } finally {
      setTarasLoading(false);
    }
  };

  const handleSaveTara = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taraForm.codigo || !taraForm.peso || !taraForm.descricao) return;

    const payload = {
      codigo: parseInt(taraForm.codigo, 10),
      peso: parseFloat(taraForm.peso) / 1000, // weight saved in kg, input is in grams
      descricao: taraForm.descricao
    };

    try {
      if (editingTara) {
        const { error } = await supabase
          .from('taras_balanca')
          .update(payload)
          .eq('id', editingTara.id);
        if (error) throw error;
        alert('Tara atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('taras_balanca')
          .insert([payload]);
        if (error) throw error;
        alert('Tara cadastrada com sucesso!');
      }
      setIsTaraModalOpen(false);
      setEditingTara(null);
      setTaraForm({ codigo: '', peso: '', descricao: '' });
      fetchTaras();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao salvar tara: ' + err.message);
    }
  };

  const handleDeleteTara = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta tara?')) return;
    try {
      const { error } = await supabase.from('taras_balanca').delete().eq('id', id);
      if (error) throw error;
      alert('Tara excluída com sucesso!');
      fetchTaras();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao excluir tara: ' + err.message);
    }
  };

  const handleSetBarcodeType = (type: string) => {
    setBarcodeType(type);
    localStorage.setItem('scale_barcode_type', type);
  };

  const exportScaleFiles = async (singleFile?: 'itens' | 'depto' | 'tara') => {
    try {
      const { data: prods, error: prodErr } = await supabase
        .from('products')
        .select('id, name, price, unit, is_available, plu_codigo, category, tara_id, taras_balanca(id, codigo, descricao, peso)')
        .eq('is_available', true);
      
      if (prodErr) throw prodErr;

      // 1. Generate depto.txt
      const deptoLine = deptoCode.padStart(2, '0') + deptoName.substring(0, 25).padEnd(25, ' ');
      const deptoContent = deptoLine + '\r\n';

      // 2. Generate tara.txt
      const { data: taraList, error: taraErr } = await supabase
        .from('taras_balanca')
        .select('*')
        .order('codigo');
      
      if (taraErr) throw taraErr;

      let taraContent = '';
      taraList?.forEach(t => {
        const codeStr = t.codigo.toString().padStart(4, '0');
        const gramsStr = Math.round(Number(t.peso) * 1000).toString().padStart(7, '0');
        const descStr = t.descricao.substring(0, 25).padEnd(25, ' ');
        taraContent += `N${codeStr}${gramsStr}00000${descStr}\r\n`;
      });

      // 3. Generate itensmgv.txt
      let itensContent = '';
      prods?.forEach(p => {
        let plu = p.plu_codigo || '';
        if (!plu && p.codigo_interno) {
          plu = p.codigo_interno.replace(/\D/g, '');
        }
        if (!plu) {
          plu = p.id.replace(/\D/g, '').substring(0, 5) || '1';
        }
        const pluStr = plu.toString().padStart(6, '0');
        const tipoStr = p.unit === 'kg' ? '0' : '1';
        const cents = Math.round((p.price || 0) * 100);
        const priceStr = cents.toString().padStart(6, '0');
        const valDays = (p.validade_dias || 0).toString().padStart(3, '0');
        const descStr = p.name.substring(0, 25).padEnd(25, ' ');

        let taraCodeStr = '0000';
        if (p.taras_balanca && p.taras_balanca.codigo !== undefined) {
          taraCodeStr = p.taras_balanca.codigo.toString().padStart(4, '0');
        } else if (p.tara_id) {
          const matchedTara = taraList?.find(t => t.id === p.tara_id);
          if (matchedTara) {
            taraCodeStr = matchedTara.codigo.toString().padStart(4, '0');
          }
        }

        itensContent += `${deptoCode.padStart(2, '0')}${pluStr}${tipoStr}${priceStr}${valDays}${descStr}${taraCodeStr}\r\n`;
      });

      const downloadFile = (filename: string, content: string) => {
        const blob = new Blob([content], { type: 'text/plain;charset=windows-1252' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };

      if (singleFile === 'itens') {
        downloadFile('itensmgv.txt', itensContent);
      } else if (singleFile === 'depto') {
        downloadFile('depto.txt', deptoContent);
      } else if (singleFile === 'tara') {
        downloadFile('tara.txt', taraContent);
      } else {
        downloadFile('itensmgv.txt', itensContent);
        setTimeout(() => downloadFile('depto.txt', deptoContent), 200);
        setTimeout(() => downloadFile('tara.txt', taraContent), 400);
      }

    } catch (err: any) {
      console.error(err);
      alert('Erro ao exportar arquivos de carga: ' + err.message);
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('site_settings').select('*').limit(1).single();
    if (!error && data) {
      setSettings({
        ...data,
        whatsapp_evo_enabled: !!data.whatsapp_evo_enabled,
        whatsapp_evo_instance: data.whatsapp_evo_instance || '',
        whatsapp_evo_token: data.whatsapp_evo_token || '',
        whatsapp_evo_group_id: data.whatsapp_evo_group_id || '',
        whatsapp_evo_notify_client_status: !!data.whatsapp_evo_notify_client_status,
        whatsapp_evo_group_notifications: data.whatsapp_evo_group_notifications || {
          new_order: false,
          status_changed: false,
          delivered: false,
          canceled: false
        },
        nfe_io_api_key: data.nfe_io_api_key || '',
        nfe_io_company_id: data.nfe_io_company_id || '',
        nfe_io_service_code: data.nfe_io_service_code || '',
        nfe_io_environment: data.nfe_io_environment || 'homologacao',
        wholesale_discount_type: data.wholesale_discount_type || 'none',
        wholesale_discount_value: Number(data.wholesale_discount_value) || 0,
        active_payment_gateway: data.active_payment_gateway || 'mercadopago',
        pagbank_enabled: !!data.pagbank_enabled,
        pagbank_environment: data.pagbank_environment || 'producao',
        pagbank_token: data.pagbank_token || '',
        pagbank_public_key: data.pagbank_public_key || ''
      });
    } else {
      console.error('Error fetching settings:', error);
    }
    setLoading(false);
  };

  const handleTestConnection = async () => {
    if (!settings || !settings.whatsapp_evo_instance) {
      alert('Por favor, preencha o nome da instância antes de testar.');
      return;
    }
    if (!testNumber) {
      alert('Por favor, digite um número com DDD (ex: 47999999999) para enviar a mensagem de teste.');
      return;
    }

    setTestingConnection(true);
    try {
      const { sendEvoMessage } = await import('../utils/whatsapp');
      const tokenToUse = settings.whatsapp_evo_token || '3YM5vSdB61yOw1Uj9gXMVH0UQoXtNNyG';
      const text = `🧪 *TESTE DE INTEGRAÇÃO - FISH HOUSE* 🐠\n\nParabéns! Sua integração com a Evolution API está funcionando perfeitamente.\n\n*Servidor:* https://appevo.voortz.com.br/\n*Instância:* ${settings.whatsapp_evo_instance}`;
      
      const success = await sendEvoMessage(
        settings.whatsapp_evo_instance,
        tokenToUse,
        testNumber,
        text
      );

      if (success) {
        alert('⚡ Mensagem de teste enviada com sucesso! Verifique seu WhatsApp.');
      } else {
        alert('❌ Falha ao enviar mensagem de teste. Verifique a URL do servidor, o nome da instância e o Token nas configurações.');
      }
    } catch (err: any) {
      console.error('Test error:', err);
      alert('Erro ao enviar mensagem de teste: ' + err.message);
    } finally {
      setTestingConnection(false);
    }
  };

  const fetchDeliveryZones = async () => {
    const { data, error } = await supabase.from('delivery_zones').select('id, neighborhood_name, fee').order('neighborhood_name');
    if (!error && data) setDeliveryZones(data);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const { id, ...payload } = settings;

    // Try primary update with all fields
    let { error } = await supabase
      .from('site_settings')
      .update(payload)
      .eq('id', id);

    // Fallback: If DB schema cache doesn't have active_payment_gateway/pagbank columns yet
    if (error && (error.message.includes('schema cache') || error.message.includes('active_payment_gateway'))) {
      console.warn('Schema cache mismatch detected. Attempting fallback update:', error.message);
      const {
        active_payment_gateway,
        pagbank_enabled,
        pagbank_environment,
        pagbank_token,
        pagbank_public_key,
        ...fallbackPayload
      } = payload as any;

      const fallbackRes = await supabase
        .from('site_settings')
        .update(fallbackPayload)
        .eq('id', id);

      error = fallbackRes.error;
    }

    if (error) {
      alert('Erro ao salvar: ' + error.message);
    } else {
      alert('Configurações salvas com sucesso! ✨');
    }
    setSaving(false);
  };

  const updateOpeningHour = (idx: number, field: keyof OpeningHour, value: any) => {
    if (!settings) return;
    const newHours = [...settings.opening_hours];
    newHours[idx] = { ...newHours[idx], [field]: value };
    setSettings({ ...settings, opening_hours: newHours });
  };

  const addCategory = () => {
    if (!newCategory || !settings) return;
    if (settings.categories.includes(newCategory)) return;
    setSettings({ ...settings, categories: [...settings.categories, newCategory] });
    setNewCategory('');
  };

  const removeCategory = (cat: string) => {
    if (!settings) return;
    setSettings({ ...settings, categories: settings.categories.filter(c => c !== cat) });
  };

  const addZone = async () => {
    if (!newZone.neighborhood_name) return;
    try {
      const { data, error } = await supabase
        .from('delivery_zones')
        .insert([{ 
          neighborhood_name: newZone.neighborhood_name, 
          fee: newZone.fee 
        }])
        .select();
        
      if (error) throw error;
      
      if (data) {
        setDeliveryZones(prev => [...prev, data[0]].sort((a,b) => a.neighborhood_name.localeCompare(b.neighborhood_name)));
        setNewZone({ neighborhood_name: '', fee: 0 });
      }
    } catch (error: any) {
      console.error('Error adding zone:', error);
      alert('Erro ao adicionar bairro: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const removeZone = async (id: string) => {
    const { error } = await supabase.from('delivery_zones').delete().eq('id', id);
    if (!error) {
      setDeliveryZones(deliveryZones.filter(z => z.id !== id));
    }
  };

  const updateZoneFee = async (id: string, fee: number) => {
    await supabase.from('delivery_zones').update({ fee }).eq('id', id);
    setDeliveryZones(deliveryZones.map(z => z.id === id ? { ...z, fee } : z));
  };

  const handleSaveSpecialDate = () => {
    if (!settings) return;
    if (!newSpecialDate.date || !newSpecialDate.label) {
      alert('Por favor, preencha a data e a etiqueta (ex: Natal ou Sexta-feira Santa).');
      return;
    }

    let updatedDates = [...(settings.special_dates || [])];
    if (editingSpecialDateIdx !== null) {
      updatedDates[editingSpecialDateIdx] = newSpecialDate;
      setEditingSpecialDateIdx(null);
    } else {
      updatedDates.push(newSpecialDate);
    }

    updatedDates.sort((a, b) => a.date.localeCompare(b.date));

    setSettings({
      ...settings,
      special_dates: updatedDates
    });

    setNewSpecialDate({ date: '', open: '09:00', close: '18:00', closed: false, label: '' });
  };

  const handleEditSpecialDate = (idx: number) => {
    if (!settings || !settings.special_dates[idx]) return;
    setNewSpecialDate(settings.special_dates[idx]);
    setEditingSpecialDateIdx(idx);
  };

  const handleCancelEditSpecialDate = () => {
    setEditingSpecialDateIdx(null);
    setNewSpecialDate({ date: '', open: '09:00', close: '18:00', closed: false, label: '' });
  };

  const removeSpecialDate = (idx: number) => {
    if (!settings) return;
    const newDates = [...settings.special_dates];
    newDates.splice(idx, 1);
    setSettings({ ...settings, special_dates: newDates });
    if (editingSpecialDateIdx === idx) {
      handleCancelEditSpecialDate();
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <RefreshCcw className="w-8 h-8 text-gold-500 animate-spin" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-8 text-center text-gray-500">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
        <p>Tabela de configurações não encontrada.</p>
        <p className="text-sm mt-2">Por favor, execute o script SQL de criação primeiro.</p>
      </div>
    );
  }

  const tabs = [
    { id: 'general', name: 'Geral', icon: Settings },
    { id: 'schedule', name: 'Horários', icon: Clock },
    { id: 'catalog', name: 'Categorias & Atacado', icon: Tag },
    { id: 'delivery', name: 'Taxas por Bairro', icon: MapPin },
    { id: 'tracking', name: 'Tracking (Ads)', icon: BarChart3 },
    { id: 'payment', name: 'Pagamentos', icon: CreditCard },
    { id: 'whatsapp', name: 'WhatsApp', icon: MessageCircle },
    { id: 'printer', name: 'Etiqueta/Comanda', icon: Printer },
    { id: 'fiscal', name: 'Fiscal (NFe.io)', icon: FileText },
    { id: 'scale', name: 'Balança', icon: Barcode },
    { id: 'desktop', name: 'Aplicativo Desktop', icon: Monitor }
  ];

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/5">
        <div>
          <h2 className="text-3xl font-display font-bold text-white uppercase tracking-tight flex items-center gap-3">
            <Settings className="text-gold-500 w-8 h-8" /> Configurações
          </h2>
          <p className="text-gray-500 text-sm mt-1">Personalize o funcionamento e a identidade do seu e-commerce.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-600 text-ink-950 px-8 py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg shadow-gold-500/10 active:scale-95 disabled:opacity-50"
        >
          {saving ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Salvar Alterações
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Tab Navigation */}
        <div className="lg:w-64 space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl text-sm font-bold uppercase tracking-widest transition-all border ${
                activeTab === tab.id 
                ? 'bg-gold-500 text-ink-950 border-gold-500 shadow-lg shadow-gold-500/10' 
                : 'text-gray-500 border-transparent hover:bg-white/5 hover:text-white'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.name}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 bg-ink-900/50 border border-white/5 rounded-3xl p-6 md:p-10 backdrop-blur-md shadow-2xl relative">
          <AnimatePresence mode="wait">
            {activeTab === 'general' && (
              <motion.div
                key="general"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] ml-1">Nome da Loja</label>
                    <div className="relative group">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-gold-500 transition-colors" />
                      <input 
                        type="text" 
                        value={settings.store_name}
                        onChange={e => setSettings({...settings, store_name: e.target.value})}
                        className="w-full bg-ink-950 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white focus:border-gold-500 transition-all outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] ml-1">CNPJ</label>
                    <div className="relative group">
                      <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-gold-500 transition-colors" />
                      <input 
                        type="text" 
                        value={settings.cnpj || ''}
                        placeholder="00.000.000/0000-00"
                        onChange={e => setSettings({...settings, cnpj: e.target.value})}
                        className="w-full bg-ink-950 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white focus:border-gold-500 transition-all outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] ml-1">WhatsApp para Atendimento</label>
                    <div className="relative group">
                      <MessageCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                      <input 
                        type="text" 
                        value={settings.whatsapp}
                        placeholder="Somente números ex: 47999999999"
                        onChange={e => setSettings({...settings, whatsapp: e.target.value})}
                        className="w-full bg-ink-950 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white focus:border-gold-500 transition-all outline-none font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] ml-1">Taxa de Entrega (R$)</label>
                    <div className="relative group">
                      <Truck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-gold-500 transition-colors" />
                      <input 
                        type="number" 
                        step="0.01"
                        value={settings.delivery_fee}
                        onChange={e => setSettings({...settings, delivery_fee: Number(e.target.value)})}
                        className="w-full bg-ink-950 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white focus:border-gold-500 transition-all outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Endereço Físico
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-[9px] text-gray-600 font-bold uppercase ml-1">Rua</label>
                      <input type="text" value={settings.address_street || ''} onChange={e => setSettings({...settings, address_street: e.target.value})} className="w-full bg-ink-950 border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-gold-500/50" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] text-gray-600 font-bold uppercase ml-1">Nº</label>
                      <input type="text" value={settings.address_number || ''} onChange={e => setSettings({...settings, address_number: e.target.value})} className="w-full bg-ink-950 border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-gold-500/50" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] text-gray-600 font-bold uppercase ml-1">Bairro</label>
                      <input type="text" value={settings.address_neighborhood || ''} onChange={e => setSettings({...settings, address_neighborhood: e.target.value})} className="w-full bg-ink-950 border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-gold-500/50" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] text-gray-600 font-bold uppercase ml-1">Cidade</label>
                      <input type="text" value={settings.address_city || ''} onChange={e => setSettings({...settings, address_city: e.target.value})} className="w-full bg-ink-950 border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-gold-500/50" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'schedule' && (
              <motion.div
                key="schedule"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <p className="text-sm text-gray-400 mb-6 bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex gap-3">
                  <Clock className="w-5 h-5 text-amber-500 shrink-0" />
                  Configure o horário de atendimento para que o sistema possa avisar o cliente e agendar pedidos fora do horário.
                </p>

                <div className="space-y-3">
                  {settings.opening_hours.sort((a,b) => (a.day === 0 ? 7 : a.day) - (b.day === 0 ? 7 : b.day)).map((hoard, idx) => (
                    <div key={hoard.day} className={`grid grid-cols-1 md:grid-cols-4 gap-4 items-center p-4 rounded-2xl border ${hoard.closed ? 'bg-white/5 border-white/5 opacity-60' : 'bg-ink-950 border-white/10 hover:border-gold-500/30'} transition-all`}>
                      <span className="text-sm font-bold text-white uppercase tracking-widest">{daysLabels[hoard.day]}</span>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-500 font-black uppercase">Abre</span>
                        <input 
                          type="time" 
                          disabled={hoard.closed}
                          value={hoard.open} 
                          onChange={e => updateOpeningHour(settings.opening_hours.findIndex(h => h.day === hoard.day), 'open', e.target.value)} 
                          className="bg-ink-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-gold-500 disabled:opacity-30"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-500 font-black uppercase">Fecha</span>
                        <input 
                          type="time" 
                          disabled={hoard.closed}
                          value={hoard.close} 
                          onChange={e => updateOpeningHour(settings.opening_hours.findIndex(h => h.day === hoard.day), 'close', e.target.value)} 
                          className="bg-ink-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-gold-500 disabled:opacity-30"
                        />
                      </div>

                      <button 
                         onClick={() => updateOpeningHour(settings.opening_hours.findIndex(h => h.day === hoard.day), 'closed', !hoard.closed)}
                         className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${hoard.closed ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20'}`}
                      >
                        {hoard.closed ? 'Loja Fechada' : 'Loja Aberta'}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="space-y-4 pt-10 border-t border-white/5">
                  <h3 className="text-lg font-bold text-white uppercase tracking-tight flex items-center gap-2">
                    <Clock className="w-5 h-5 text-gold-500" /> Datas Especiais e Feriados
                  </h3>
                  <p className="text-sm text-gray-500">Configure horários diferenciados para feriados nacionais, municipais ou ocasiões especiais.</p>
                  
                  <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        {editingSpecialDateIdx !== null ? '✏️ Editar Data Especial' : '➕ Adicionar Nova Data Especial'}
                      </h4>
                      {editingSpecialDateIdx !== null && (
                        <button 
                          onClick={handleCancelEditSpecialDate}
                          className="text-xs text-gold-500 hover:underline"
                        >
                          Cancelar edição
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Data</label>
                        <input 
                          type="date" 
                          value={newSpecialDate.date}
                          onChange={e => setNewSpecialDate({...newSpecialDate, date: e.target.value})}
                          className="w-full bg-ink-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:border-gold-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Etiqueta / Nome</label>
                        <input 
                          type="text" 
                          placeholder="Ex: Natal, Sexta-feira Santa"
                          value={newSpecialDate.label}
                          onChange={e => setNewSpecialDate({...newSpecialDate, label: e.target.value})}
                          className="w-full bg-ink-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:border-gold-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Status da Loja</label>
                        <div className="flex bg-ink-950 p-1 rounded-xl border border-white/10">
                          <button
                            type="button"
                            onClick={() => setNewSpecialDate({ ...newSpecialDate, closed: true })}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                              newSpecialDate.closed 
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                                : 'text-gray-500 hover:text-white'
                            }`}
                          >
                            🔴 Fechado
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewSpecialDate({ ...newSpecialDate, closed: false })}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                              !newSpecialDate.closed 
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                : 'text-gray-500 hover:text-white'
                            }`}
                          >
                            🟢 Horário Especial
                          </button>
                        </div>
                      </div>
                    </div>

                    {!newSpecialDate.closed && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/5">
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Horário de Abertura</label>
                          <input 
                            type="time" 
                            value={newSpecialDate.open}
                            onChange={e => setNewSpecialDate({...newSpecialDate, open: e.target.value})}
                            className="w-full bg-ink-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:border-gold-500 outline-none"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Horário de Fechamento</label>
                          <input 
                            type="time" 
                            value={newSpecialDate.close}
                            onChange={e => setNewSpecialDate({...newSpecialDate, close: e.target.value})}
                            className="w-full bg-ink-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:border-gold-500 outline-none"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end pt-2">
                      <button 
                        onClick={handleSaveSpecialDate}
                        className="bg-gold-500 hover:bg-gold-600 text-ink-950 px-6 py-3 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shadow-lg shadow-gold-500/10 active:scale-95"
                      >
                        {editingSpecialDateIdx !== null ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        {editingSpecialDateIdx !== null ? 'Salvar Alteração' : 'Adicionar Data Especial'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 pt-4">
                    {(settings.special_dates || []).map((sd, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-ink-950 border border-white/5 p-4 rounded-2xl group hover:border-white/10 transition-all">
                         <div className="flex items-center gap-4">
                            <div className="bg-white/5 px-3 py-1.5 rounded-lg text-gold-500 font-mono text-xs font-bold">
                               {new Date(sd.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </div>
                            <div>
                               <p className="text-white text-xs font-bold uppercase tracking-widest">{sd.label}</p>
                               {!sd.closed ? (
                                 <p className="text-[10px] text-green-400 font-medium">Aberto das {sd.open} às {sd.close}</p>
                               ) : (
                                 <p className="text-[10px] text-red-500 font-bold">FECHADO O DIA TODO</p>
                               )}
                            </div>
                         </div>
                         <div className="flex items-center gap-1">
                           <button 
                             onClick={() => handleEditSpecialDate(idx)}
                             title="Editar data"
                             className="p-2 text-gray-400 hover:text-gold-500 hover:bg-white/5 rounded-lg transition-colors"
                           >
                             <Edit2 className="w-4 h-4" />
                           </button>
                           <button 
                             onClick={() => removeSpecialDate(idx)}
                             title="Excluir data"
                             className="p-2 text-gray-400 hover:text-red-500 hover:bg-white/5 rounded-lg transition-colors"
                           >
                             <Trash2 className="w-5 h-5" />
                           </button>
                         </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'catalog' && (
              <motion.div
                key="catalog"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-white uppercase tracking-tight flex items-center gap-2">
                    <Tag className="w-5 h-5 text-gold-500" /> Gestão de Categorias
                  </h3>
                  <p className="text-sm text-gray-500">As categorias aparecem nos filtros do catálogo e no cadastro de produtos.</p>
                  
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Nova categoria (ex: 🐟 Filés)"
                      value={newCategory}
                      onChange={e => setNewCategory(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addCategory()}
                      className="flex-1 bg-ink-950 border border-white/10 rounded-2xl px-4 py-4 text-white focus:border-gold-500 outline-none"
                    />
                    <button 
                      onClick={addCategory}
                      className="bg-gold-500 hover:bg-gold-600 text-ink-950 px-6 rounded-2xl font-black transition-all"
                    >
                      <Plus className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4">
                    {settings.categories.map((cat) => (
                      <div key={cat} className="flex items-center justify-between bg-white/5 border border-white/5 p-4 rounded-2xl hover:border-gold-500/20 transition-all group">
                        <span className="text-sm font-bold text-white uppercase tracking-wide">{cat}</span>
                        <button 
                          onClick={() => removeCategory(cat)}
                          className="p-2 text-gray-600 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-8 border-t border-white/5 space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-white uppercase tracking-tight flex items-center gap-2">
                      <Tag className="w-5 h-5 text-gold-500" /> Regra Global de Desconto (Atacado)
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Aplica um desconto automático sobre o preço de varejo para todos os produtos no catálogo de atacado que não tiverem um preço de atacado manual definido.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-white/5 p-6 rounded-3xl border border-white/10">
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block ml-1">Tipo de Desconto</label>
                      <select
                        value={settings.wholesale_discount_type || 'none'}
                        onChange={(e) => setSettings({ ...settings, wholesale_discount_type: e.target.value })}
                        className="w-full bg-ink-950 border border-white/10 rounded-xl p-4 text-sm text-white focus:border-gold-500 outline-none font-semibold bg-[image:none]"
                      >
                        <option value="none">Desabilitado (Sem desconto global)</option>
                        <option value="percentage">Porcentagem (%)</option>
                        <option value="fixed">Valor Fixo (R$)</option>
                      </select>
                    </div>

                    {(settings.wholesale_discount_type === 'percentage' || settings.wholesale_discount_type === 'fixed') && (
                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block ml-1">
                          {settings.wholesale_discount_type === 'percentage' ? 'Porcentagem de Desconto (%)' : 'Valor do Desconto (R$)'}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={settings.wholesale_discount_value || 0}
                          onChange={(e) => setSettings({ ...settings, wholesale_discount_value: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-ink-950 border border-white/10 rounded-xl p-4 text-sm text-white focus:border-gold-500 outline-none font-semibold"
                          placeholder="0.00"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'delivery' && (
              <motion.div
                key="delivery"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-white uppercase tracking-tight flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-gold-500" /> Taxas por Bairro
                  </h3>
                  <p className="text-sm text-gray-500">Configure o custo de entrega automático para cada bairro de Navegantes e região.</p>
                  
                  <div className="flex flex-col md:flex-row gap-3 bg-white/5 p-6 rounded-3xl border border-white/10 mt-6">
                    <div className="flex-1 space-y-1.5">
                      <label className="text-[9px] text-gray-500 font-bold uppercase ml-1 tracking-widest">Nome do Bairro</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Gravatá"
                        value={newZone.neighborhood_name}
                        onChange={e => setNewZone({...newZone, neighborhood_name: e.target.value})}
                        className="w-full bg-ink-950 border border-white/10 rounded-xl p-4 text-sm text-white focus:border-gold-500"
                      />
                    </div>
                    <div className="md:w-32 space-y-1.5">
                      <label className="text-[9px] text-gray-500 font-bold uppercase ml-1 tracking-widest">Taxa (R$)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={newZone.fee}
                        onChange={e => setNewZone({...newZone, fee: Number(e.target.value)})}
                        className="w-full bg-ink-950 border border-white/10 rounded-xl p-4 text-sm text-white focus:border-gold-500 text-center"
                      />
                    </div>
                    <button 
                      onClick={addZone}
                      className="md:self-end bg-gold-500 hover:bg-gold-600 text-ink-950 px-6 h-[52px] rounded-xl font-black transition-all"
                    >
                      <Plus className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="space-y-3 pt-6">
                    {deliveryZones.map((zone) => (
                      <div key={zone.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-ink-950 border border-white/5 p-4 rounded-2xl hover:border-gold-500/20 transition-all gap-4">
                        <span className="text-sm font-bold text-white uppercase tracking-wide">{zone.neighborhood_name}</span>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                            <span className="text-[9px] text-gray-600 font-black tracking-widest">R$</span>
                            <input 
                              type="number" 
                              step="0.01"
                              value={zone.fee}
                              onChange={(e) => updateZoneFee(zone.id, Number(e.target.value))}
                              className="w-16 bg-transparent text-sm font-bold text-gold-400 outline-none text-right"
                            />
                          </div>
                          <button 
                            onClick={() => removeZone(zone.id)}
                            className="p-2 text-gray-600 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'tracking' && (
              <motion.div
                key="tracking"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <BarChart3 className="w-6 h-6 text-gold-500" />
                    <h3 className="text-lg font-bold text-white uppercase tracking-tight">Analytics & Marketing</h3>
                  </div>

                  <div className="space-y-6">
                    <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#24ddfd]/20 rounded-lg flex items-center justify-center text-[#24ddfd]">
                          <Code2 className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-black text-white uppercase tracking-widest">Google Tag Manager (GTM)</span>
                      </div>
                      <input 
                        type="text" 
                        value={settings.tracking_gtm || ''}
                        placeholder="GTM-XXXXXXX"
                        onChange={e => setSettings({...settings, tracking_gtm: e.target.value})}
                        className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white focus:border-gold-500 transition-all outline-none font-mono text-sm"
                      />
                      <p className="text-[10px] text-gray-500">Insira apenas o ID do GTM para rastreamento completo.</p>
                    </div>

                    <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#0668E1]/20 rounded-lg flex items-center justify-center text-[#0668E1]">
                           <Smartphone className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-black text-white uppercase tracking-widest">Meta/Facebook Pixel</span>
                      </div>
                      <input 
                        type="text" 
                        value={settings.tracking_pixel || ''}
                        placeholder="ID do Pixel"
                        onChange={e => setSettings({...settings, tracking_pixel: e.target.value})}
                        className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white focus:border-gold-500 transition-all outline-none font-mono text-sm"
                      />
                    </div>

                    <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#FFBD00]/20 rounded-lg flex items-center justify-center text-[#FFBD00]">
                          <BarChart3 className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-black text-white uppercase tracking-widest">Google Ads</span>
                      </div>
                      <input 
                        type="text" 
                        value={settings.tracking_gads || ''}
                        placeholder="AW-XXXXXXXXX"
                        onChange={e => setSettings({...settings, tracking_gads: e.target.value})}
                        className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white focus:border-gold-500 transition-all outline-none font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'payment' && (
              <motion.div
                key="payment"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* Gateway Selector */}
                <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-4">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-6 h-6 text-gold-500" />
                    <div>
                      <h3 className="text-lg font-bold text-white uppercase tracking-tight">Gateway Principal Ativo</h3>
                      <p className="text-xs text-gray-400">Escolha qual gateway de pagamento será usado para processar os pedidos do checkout.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, active_payment_gateway: 'mercadopago' })}
                      className={`p-5 rounded-2xl border flex items-center justify-between transition-all ${
                        (settings.active_payment_gateway || 'mercadopago') === 'mercadopago'
                          ? 'bg-gold-500/10 border-gold-500 text-white shadow-lg shadow-gold-500/10'
                          : 'bg-ink-950 border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          (settings.active_payment_gateway || 'mercadopago') === 'mercadopago' ? 'border-gold-500 bg-gold-500' : 'border-gray-500'
                        }`}>
                          {(settings.active_payment_gateway || 'mercadopago') === 'mercadopago' && (
                            <div className="w-1.5 h-1.5 rounded-full bg-ink-950" />
                          )}
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-sm">Mercado Pago</p>
                          <p className="text-[10px] text-gray-500">PIX & Cartão de Crédito</p>
                        </div>
                      </div>
                      <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${
                        (settings.active_payment_gateway || 'mercadopago') === 'mercadopago' ? 'bg-gold-500 text-ink-950' : 'bg-white/5 text-gray-500'
                      }`}>
                        {(settings.active_payment_gateway || 'mercadopago') === 'mercadopago' ? 'Ativo no Checkout' : 'Inativo'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, active_payment_gateway: 'pagbank' })}
                      className={`p-5 rounded-2xl border flex items-center justify-between transition-all ${
                        settings.active_payment_gateway === 'pagbank'
                          ? 'bg-gold-500/10 border-gold-500 text-white shadow-lg shadow-gold-500/10'
                          : 'bg-ink-950 border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          settings.active_payment_gateway === 'pagbank' ? 'border-gold-500 bg-gold-500' : 'border-gray-500'
                        }`}>
                          {settings.active_payment_gateway === 'pagbank' && (
                            <div className="w-1.5 h-1.5 rounded-full bg-ink-950" />
                          )}
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-sm">PagBank (PagSeguro)</p>
                          <p className="text-[10px] text-gray-500">PIX & Cartão de Crédito V4</p>
                        </div>
                      </div>
                      <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${
                        settings.active_payment_gateway === 'pagbank' ? 'bg-gold-500 text-ink-950' : 'bg-white/5 text-gray-500'
                      }`}>
                        {settings.active_payment_gateway === 'pagbank' ? 'Ativo no Checkout' : 'Inativo'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Mercado Pago Section */}
                <div className="space-y-6 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-6 h-6 text-gold-500" />
                      <h3 className="text-lg font-bold text-white uppercase tracking-tight">Mercado Pago</h3>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={settings.mercadopago_enabled}
                        onChange={e => setSettings({...settings, mercadopago_enabled: e.target.checked})}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-white/5 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-gray-500 peer-checked:after:bg-gold-500 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold-500/20" />
                      <span className="ms-3 text-xs font-bold text-gray-400 uppercase tracking-widest">{settings.mercadopago_enabled ? 'Habilitado' : 'Desabilitado'}</span>
                    </label>
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-3xl flex gap-4">
                    <ShieldCheck className="w-6 h-6 text-amber-500 shrink-0" />
                    <div className="text-sm">
                      <p className="text-white font-bold mb-1">Credenciais Mercado Pago</p>
                      <p className="text-gray-400 leading-relaxed">Insira suas chaves de produção do Mercado Pago para aceitar pagamentos reais via PIX e Cartão de Crédito.</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] ml-1">Public Key (Produção)</label>
                      <input 
                        type="text" 
                        value={settings.mercadopago_public_key || ''}
                        placeholder="APP_USR-..."
                        onChange={e => setSettings({...settings, mercadopago_public_key: e.target.value})}
                        className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white focus:border-gold-500 transition-all outline-none font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] ml-1">Access Token (Produção)</label>
                      <div className="relative">
                        <input 
                          type="password" 
                          value={settings.mercadopago_access_token || ''}
                          placeholder="APP_USR-..."
                          onChange={e => setSettings({...settings, mercadopago_access_token: e.target.value})}
                          className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white focus:border-gold-500 transition-all outline-none font-mono text-sm pr-12"
                        />
                        <ShieldCheck className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                    <h4 className="text-xs font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" /> Webhook Mercado Pago
                    </h4>
                    {(() => {
                      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
                      const projectRef = supabaseUrl.split('.')[0].replace('https://', '');
                      const webhookUrl = `https://${projectRef}.functions.supabase.co/mercadopago-webhook`;
                      return (
                        <div className="bg-ink-950 border border-white/5 p-4 rounded-xl flex items-center justify-between gap-4">
                          <code className="text-[10px] text-gold-500 break-all">{webhookUrl}</code>
                          <button 
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(webhookUrl);
                              alert('URL do Webhook do Mercado Pago copiada!');
                            }}
                            className="bg-white/5 text-[9px] font-black uppercase px-3 py-1.5 rounded-lg hover:bg-white/10 transition-all"
                          >
                            Copiar
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* PagBank Section */}
                <div className="space-y-6 pt-8 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-6 h-6 text-gold-500" />
                      <h3 className="text-lg font-bold text-white uppercase tracking-tight">PagBank (PagSeguro)</h3>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={settings.pagbank_enabled || false}
                        onChange={e => setSettings({...settings, pagbank_enabled: e.target.checked})}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-white/5 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-gray-500 peer-checked:after:bg-gold-500 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold-500/20" />
                      <span className="ms-3 text-xs font-bold text-gray-400 uppercase tracking-widest">{settings.pagbank_enabled ? 'Habilitado' : 'Desabilitado'}</span>
                    </label>
                  </div>

                  <div className="bg-gold-500/10 border border-gold-500/20 p-6 rounded-3xl flex gap-4">
                    <ShieldCheck className="w-6 h-6 text-gold-500 shrink-0" />
                    <div className="text-sm">
                      <p className="text-white font-bold mb-1">Configuração PagBank (API v4)</p>
                      <p className="text-gray-400 leading-relaxed">
                        Obtenha seu Token no painel do PagBank em <strong>Aplicações &gt; Tokens de Acesso</strong>. Insira abaixo para aceitar PIX e Cartão de Crédito com conciliação automática.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] ml-1">Ambiente de Operação</label>
                      <div className="flex bg-ink-950 p-1.5 rounded-2xl border border-white/10 max-w-md">
                        <button
                          type="button"
                          onClick={() => setSettings({ ...settings, pagbank_environment: 'producao' })}
                          className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${
                            (settings.pagbank_environment || 'producao') === 'producao'
                              ? 'bg-gold-500 text-ink-950 shadow-md'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          🟢 Produção (Real)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSettings({ ...settings, pagbank_environment: 'sandbox' })}
                          className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${
                            settings.pagbank_environment === 'sandbox'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          🧪 Sandbox (Testes)
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] ml-1">Token de Acesso PagBank (Bearer Token)</label>
                      <div className="relative">
                        <input 
                          type="password" 
                          value={settings.pagbank_token || ''}
                          placeholder="Insira o Token do PagBank..."
                          onChange={e => setSettings({...settings, pagbank_token: e.target.value})}
                          className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white focus:border-gold-500 transition-all outline-none font-mono text-sm pr-12"
                        />
                        <ShieldCheck className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                      </div>
                      <p className="text-[10px] text-gray-500 italic">Usado com segurança pela Edge Function backend para criar cobranças PIX e Cartão no PagBank.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] ml-1">Chave Pública de Criptografia (Public Key / Cartão)</label>
                      <input 
                        type="text" 
                        value={settings.pagbank_public_key || ''}
                        placeholder="MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA..."
                        onChange={e => setSettings({...settings, pagbank_public_key: e.target.value})}
                        className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white focus:border-gold-500 transition-all outline-none font-mono text-sm"
                      />
                      <p className="text-[10px] text-gray-500 italic">Necessário apenas para criptografia transparente de dados de cartão de crédito no navegador do cliente.</p>
                    </div>
                  </div>

                  <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                    <h4 className="text-xs font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" /> Webhook PagBank
                    </h4>
                    <p className="text-[10px] text-gray-400 mb-4 leading-relaxed">
                      Cadastre a URL abaixo nas configurações de Notificação de Transações no painel do PagBank:
                    </p>
                    {(() => {
                      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
                      const projectRef = supabaseUrl.split('.')[0].replace('https://', '');
                      const webhookUrl = `https://${projectRef}.functions.supabase.co/pagbank-webhook`;
                      return (
                        <div className="bg-ink-950 border border-white/5 p-4 rounded-xl flex items-center justify-between gap-4">
                          <code className="text-[10px] text-gold-500 break-all">{webhookUrl}</code>
                          <button 
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(webhookUrl);
                              alert('URL do Webhook do PagBank copiada!');
                            }}
                            className="bg-white/5 text-[9px] font-black uppercase px-3 py-1.5 rounded-lg hover:bg-white/10 transition-all"
                          >
                            Copiar
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                  <div className="pt-8 border-t border-white/5 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-6 bg-white/5 rounded-3xl border border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <QrCode className="w-6 h-6 text-gold-500" />
                          <div className="text-left">
                            <p className="text-sm font-black text-white uppercase tracking-widest">PIX via Mercado Pago</p>
                            <p className="text-[10px] text-gray-500">Liberação instantânea</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={settings.pix_enabled}
                            onChange={e => setSettings({...settings, pix_enabled: e.target.checked})}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-white/5 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-gray-500 peer-checked:after:bg-gold-500 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold-500/20" />
                        </label>
                      </div>

                      <div className="p-6 bg-white/5 rounded-3xl border border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CreditCard className="w-6 h-6 text-gold-500" />
                          <div className="text-left">
                            <p className="text-sm font-black text-white uppercase tracking-widest">Cartão de Crédito</p>
                            <p className="text-[10px] text-gray-500">Checkout Transparente</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={settings.credit_card_enabled}
                            onChange={e => setSettings({...settings, credit_card_enabled: e.target.checked})}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-white/5 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-gray-500 peer-checked:after:bg-gold-500 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold-500/20" />
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Tag className="w-6 h-6 text-gold-500" />
                        <h3 className="text-lg font-bold text-white uppercase tracking-tight">Desconto no PIX</h3>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={settings.pix_discount_enabled}
                          onChange={e => setSettings({...settings, pix_discount_enabled: e.target.checked})}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-white/5 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-gray-500 peer-checked:after:bg-gold-500 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold-500/20" />
                        <span className="ms-3 text-xs font-bold text-gray-400 uppercase tracking-widest">{settings.pix_discount_enabled ? 'Ativado' : 'Desativado'}</span>
                      </label>
                    </div>

                    {settings.pix_discount_enabled && (
                      <div className="space-y-2 max-w-xs">
                        <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] ml-1">Percentual de Desconto (%)</label>
                        <div className="relative group">
                          <input 
                            type="number" 
                            value={settings.pix_discount_percent}
                            onChange={e => setSettings({...settings, pix_discount_percent: Number(e.target.value)})}
                            className="w-full bg-ink-950 border border-white/10 rounded-2xl px-4 py-4 text-white focus:border-gold-500 transition-all outline-none"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">%</span>
                        </div>
                        <p className="text-[10px] text-gray-500 italic">Este desconto será aplicado automaticamente no checkout para pagamentos via PIX.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

            {activeTab === 'printer' && (
              <motion.div
                key="printer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="space-y-6">
                   <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-6">
                      <div className="flex items-center gap-3">
                        <Printer className="w-6 h-6 text-gold-500" />
                        <h3 className="text-lg font-bold text-white uppercase tracking-tight">Comanda Térmica (Impressão)</h3>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] text-gray-500 font-bold uppercase ml-1">Título do Cabeçalho</label>
                          <input 
                            type="text" 
                            value={settings.label_config.header}
                            onChange={e => setSettings({...settings, label_config: {...settings.label_config, header: e.target.value}})}
                            className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white focus:border-gold-500 transition-all outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] text-gray-500 font-bold uppercase ml-1">Rodapé da Comanda</label>
                          <input 
                            type="text" 
                            value={settings.label_config.footer}
                            onChange={e => setSettings({...settings, label_config: {...settings.label_config, footer: e.target.value}})}
                            className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white focus:border-gold-500 transition-all outline-none"
                          />
                        </div>
                      </div>

                      <div className="bg-ink-950/50 p-6 rounded-[2rem] border border-dashed border-white/10">
                        <p className="text-[9px] text-gray-600 font-black uppercase text-center mb-4 tracking-[0.3em]">Pré-visualização do Topo</p>
                        <div className="flex flex-col items-center gap-1 font-mono text-xs uppercase text-gray-400">
                          <p className="text-sm font-bold text-gray-300">{settings.label_config.header}</p>
                          <p>===============================</p>
                          <p>PEDIDO #4F2G9H1</p>
                          <p className="text-[10px] mt-1">{new Date().toLocaleString()}</p>
                        </div>
                      </div>
                   </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'whatsapp' && (
              <motion.div
                key="whatsapp"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <MessageCircle className="w-6 h-6 text-green-500" />
                      <h3 className="text-lg font-bold text-white uppercase tracking-tight">Evolution API (WhatsApp)</h3>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={settings.whatsapp_evo_enabled || false}
                        onChange={e => setSettings({...settings, whatsapp_evo_enabled: e.target.checked})}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-white/5 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-gray-500 peer-checked:after:bg-green-500 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500/20" />
                      <span className="ms-3 text-xs font-bold text-gray-400 uppercase tracking-widest">{settings.whatsapp_evo_enabled ? 'Ativado' : 'Desativado'}</span>
                    </label>
                  </div>

                  <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-3xl flex gap-4">
                    <MessageCircle className="w-6 h-6 text-green-500 shrink-0" />
                    <div className="text-sm">
                      <p className="text-white font-bold mb-1">Notificações Automáticas no WhatsApp</p>
                      <p className="text-gray-400 leading-relaxed">
                        Conecte a Evolution API para enviar mensagens automáticas de atualização para os seus clientes e avisos de novos pedidos diretamente no grupo de WhatsApp da sua loja.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/5">
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] ml-1">URL do Servidor Evolution</label>
                      <input 
                        type="text" 
                        readOnly
                        value="https://appevo.voortz.com.br/"
                        className="w-full bg-ink-950/50 border border-white/5 rounded-2xl p-4 text-gray-500 transition-all outline-none font-mono text-sm cursor-not-allowed"
                      />
                      <p className="text-[9px] text-gray-600">Servidor configurado por padrão.</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] ml-1">Nome da Instância</label>
                      <input 
                        type="text" 
                        value={settings.whatsapp_evo_instance || ''}
                        placeholder="Nome da sua instância (ex: fishhouse)"
                        onChange={e => setSettings({...settings, whatsapp_evo_instance: e.target.value})}
                        className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white focus:border-gold-500 transition-all outline-none font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] ml-1">Token da Instância (API Key)</label>
                    <input 
                      type="password" 
                      value={settings.whatsapp_evo_token || ''}
                      placeholder="Deixe em branco para usar o Token Global"
                      onChange={e => setSettings({...settings, whatsapp_evo_token: e.target.value})}
                      className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white focus:border-gold-500 transition-all outline-none font-mono text-sm"
                    />
                    <p className="text-[9px] text-gray-600">Caso sua instância utilize o Token Global (`3YM5vSdB6...`), pode deixar este campo em branco.</p>
                  </div>

                  <div className="pt-6 border-t border-white/5 space-y-6">
                    <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                      💬 Notificações do Cliente
                    </h4>
                    <div className="p-6 bg-white/5 rounded-3xl border border-white/10 flex items-center justify-between">
                      <div className="text-left">
                        <p className="text-sm font-black text-white uppercase tracking-widest">Enviar Status para o Cliente</p>
                        <p className="text-[10px] text-gray-500 mt-1 leading-normal">Notifica o cliente quando o pedido for Recebido, em Preparo, Enviado, Entregue ou Cancelado.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={settings.whatsapp_evo_notify_client_status || false}
                          onChange={e => setSettings({...settings, whatsapp_evo_notify_client_status: e.target.checked})}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-white/5 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-gray-500 peer-checked:after:bg-gold-500 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold-500/20" />
                      </label>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/5 space-y-6">
                    <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                      👥 Notificações de Grupo da Loja
                    </h4>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] ml-1">JID / ID do Grupo do WhatsApp</label>
                      <input 
                        type="text" 
                        value={settings.whatsapp_evo_group_id || ''}
                        placeholder="Ex: 1203630234567890@g.us"
                        onChange={e => setSettings({...settings, whatsapp_evo_group_id: e.target.value})}
                        className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white focus:border-gold-500 transition-all outline-none font-mono text-sm"
                      />
                      <p className="text-[9px] text-gray-600">ID único do grupo do WhatsApp onde a equipe receberá os alertas.</p>
                    </div>

                    <div className="bg-white/5 rounded-3xl border border-white/10 p-6 space-y-4">
                      <p className="text-xs font-black text-white uppercase tracking-wider">Eventos para enviar ao Grupo:</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center justify-between p-3 bg-ink-950 rounded-xl border border-white/5">
                          <span className="text-xs text-gray-300 font-bold uppercase tracking-wider">Novo Pedido 🚨</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={settings.whatsapp_evo_group_notifications?.new_order || false}
                              onChange={e => setSettings({
                                ...settings,
                                whatsapp_evo_group_notifications: {
                                  ...settings.whatsapp_evo_group_notifications!,
                                  new_order: e.target.checked
                                }
                              })}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-white/5 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-gray-500 peer-checked:after:bg-gold-500 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gold-500/20" />
                          </label>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-ink-950 rounded-xl border border-white/5">
                          <span className="text-xs text-gray-300 font-bold uppercase tracking-wider">Pedido Alterado 🔄</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={settings.whatsapp_evo_group_notifications?.status_changed || false}
                              onChange={e => setSettings({
                                ...settings,
                                whatsapp_evo_group_notifications: {
                                  ...settings.whatsapp_evo_group_notifications!,
                                  status_changed: e.target.checked
                                }
                              })}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-white/5 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-gray-500 peer-checked:after:bg-gold-500 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gold-500/20" />
                          </label>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-ink-950 rounded-xl border border-white/5">
                          <span className="text-xs text-gray-300 font-bold uppercase tracking-wider">Pedido Entregue 🏁</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={settings.whatsapp_evo_group_notifications?.delivered || false}
                              onChange={e => setSettings({
                                ...settings,
                                whatsapp_evo_group_notifications: {
                                  ...settings.whatsapp_evo_group_notifications!,
                                  delivered: e.target.checked
                                }
                              })}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-white/5 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-gray-500 peer-checked:after:bg-gold-500 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gold-500/20" />
                          </label>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-ink-950 rounded-xl border border-white/5">
                          <span className="text-xs text-gray-300 font-bold uppercase tracking-wider">Pedido Cancelado ❌</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={settings.whatsapp_evo_group_notifications?.canceled || false}
                              onChange={e => setSettings({
                                ...settings,
                                whatsapp_evo_group_notifications: {
                                  ...settings.whatsapp_evo_group_notifications!,
                                  canceled: e.target.checked
                                }
                              })}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-white/5 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-gray-500 peer-checked:after:bg-gold-500 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gold-500/20" />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/5 space-y-6">
                    <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                      🧪 Teste de Conexão
                    </h4>
                    
                    <div className="bg-white/5 rounded-3xl border border-white/10 p-6 flex flex-col md:flex-row gap-4 items-end">
                      <div className="flex-1 space-y-1.5 w-full">
                        <label className="text-[9px] text-gray-500 font-bold uppercase ml-1 tracking-widest">Número p/ Teste (Somente Números c/ DDD)</label>
                        <input 
                          type="text" 
                          placeholder="Ex: 47999999999"
                          value={testNumber}
                          onChange={e => setTestNumber(e.target.value)}
                          className="w-full bg-ink-950 border border-white/10 rounded-xl p-4 text-xs text-white focus:border-gold-500 outline-none font-mono"
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={handleTestConnection}
                        disabled={testingConnection}
                        className="bg-gold-500 hover:bg-gold-600 text-ink-950 px-6 h-[52px] rounded-xl font-black uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
                      >
                        {testingConnection ? <RefreshCcw className="w-4 h-4 animate-spin" /> : null}
                        Enviar Mensagem de Teste
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'fiscal' && (
              <motion.div
                key="fiscal"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6 text-gold-500" />
                    <h3 className="text-lg font-bold text-white uppercase tracking-tight">Configurações Fiscais (NFe.io)</h3>
                  </div>

                  <p className="text-sm text-gray-400 bg-white/5 border border-white/5 p-4 rounded-2xl leading-relaxed">
                    Integração com a plataforma **NFe.io** para emissão automatizada de Notas Fiscais de Produto (NFC-e / NF-e) ou de Serviço (NFS-e). Preencha os campos abaixo quando possuir as credenciais da sua conta NFe.io.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] ml-1">Chave de API (ApiKey)</label>
                      <input 
                        type="password" 
                        value={settings.nfe_io_api_key || ''}
                        placeholder="Chave privada de API do NFe.io"
                        onChange={e => setSettings({...settings, nfe_io_api_key: e.target.value})}
                        className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white focus:border-gold-500 transition-all outline-none font-mono text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] ml-1">ID da Empresa (Company ID)</label>
                      <input 
                        type="text" 
                        value={settings.nfe_io_company_id || ''}
                        placeholder="ID da empresa cadastrada no NFe.io"
                        onChange={e => setSettings({...settings, nfe_io_company_id: e.target.value})}
                        className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white focus:border-gold-500 transition-all outline-none font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] ml-1">Código de Serviço Municipal (Opcional)</label>
                      <input 
                        type="text" 
                        value={settings.nfe_io_service_code || ''}
                        placeholder="Ex: 1.05 (Apenas se emitir nota de serviço)"
                        onChange={e => setSettings({...settings, nfe_io_service_code: e.target.value})}
                        className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white focus:border-gold-500 transition-all outline-none font-mono text-sm"
                      />
                      <p className="text-[9px] text-gray-600">Se preenchido, o sistema emitirá Notas Fiscais de Serviço (NFS-e) ao invés de Notas de Produto (NFC-e/NF-e).</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] ml-1">Ambiente de Emissão</label>
                      <select
                        value={settings.nfe_io_environment || 'homologacao'}
                        onChange={e => setSettings({...settings, nfe_io_environment: e.target.value as any})}
                        className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white focus:border-gold-500 transition-all outline-none text-sm"
                      >
                        <option value="homologacao">Homologação (Testes sem valor fiscal)</option>
                        <option value="producao">Produção (Nota real com valor fiscal)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'scale' && (
              <motion.div
                key="scale"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8 text-xs font-bold text-gray-300"
              >
                <div>
                  <h3 className="text-xl font-display font-bold text-white flex items-center gap-2">
                    <Barcode className="text-gold-500 w-6 h-6" /> Integração de Balança
                  </h3>
                  <p className="text-gray-500 text-xs mt-1 font-medium">Cadastre taras e baixe arquivos de carga para balança Toledo MGV 7.</p>
                </div>

                {/* Seção 1: Configuração de Códigos de Barras e Gerador */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-ink-950/40 p-6 rounded-3xl border border-white/5">
                  <div className="space-y-6">
                    <h4 className="text-sm text-gold-500 font-bold uppercase tracking-wider">Carga de Balança (Toledo MGV 7)</h4>
                    
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest block ml-1">Padrão de Código de Barras</label>
                        <select
                          value={barcodeType}
                          onChange={e => handleSetBarcodeType(e.target.value)}
                          className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white font-bold outline-none cursor-pointer"
                        >
                          <option value="price">Preço Total (EAN-13 começa com 2 + PLU + Preço Total)</option>
                          <option value="weight">Peso Líquido (EAN-13 começa com 2 + PLU + Peso em Gramas)</option>
                        </select>
                        <p className="text-[10px] text-gray-500 font-normal leading-relaxed ml-1 mt-1">
                          Define como o ERP irá interpretar os códigos de barras de balança escaneados nas compras e saídas.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest block ml-1">Cód. Depto</label>
                          <input
                            type="text"
                            value={deptoCode}
                            onChange={e => setDeptoCode(e.target.value)}
                            maxLength={2}
                            placeholder="01"
                            className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-gold-500 font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest block ml-1">Nome Depto</label>
                          <input
                            type="text"
                            value={deptoName}
                            onChange={e => setDeptoName(e.target.value)}
                            maxLength={25}
                            placeholder="PEIXARIA"
                            className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-gold-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => exportScaleFiles()}
                        className="bg-gold-500 hover:bg-gold-600 text-ink-950 font-black px-5 py-3 rounded-2xl uppercase tracking-wider text-[10px] transition-all flex items-center gap-1.5 shadow-lg shadow-gold-500/5 active:scale-95"
                      >
                        Baixar Todos os Arquivos (TXTs)
                      </button>
                      <button
                        type="button"
                        onClick={() => exportScaleFiles('itens')}
                        className="bg-white/5 hover:bg-white/10 text-white border border-white/5 font-black px-4 py-3 rounded-2xl uppercase tracking-wider text-[10px] transition-all"
                      >
                        itensmgv.txt
                      </button>
                      <button
                        type="button"
                        onClick={() => exportScaleFiles('tara')}
                        className="bg-white/5 hover:bg-white/10 text-white border border-white/5 font-black px-4 py-3 rounded-2xl uppercase tracking-wider text-[10px] transition-all"
                      >
                        tara.txt
                      </button>
                      <button
                        type="button"
                        onClick={() => exportScaleFiles('depto')}
                        className="bg-white/5 hover:bg-white/10 text-white border border-white/5 font-black px-4 py-3 rounded-2xl uppercase tracking-wider text-[10px] transition-all"
                      >
                        depto.txt
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 border-l border-white/5 pl-0 md:pl-8 flex flex-col justify-center">
                    <h5 className="text-xs text-white font-bold uppercase tracking-wider">Como Importar na Balança Toledo:</h5>
                    <ul className="space-y-2 text-[11px] text-gray-500 font-medium list-decimal list-inside leading-relaxed font-normal">
                      <li>Gere e baixe os arquivos acima.</li>
                      <li>No software **MGV 7** da Toledo, acesse a aba de importação de cadastro.</li>
                      <li>Aponte para a pasta contendo os arquivos `itensmgv.txt`, `tara.txt` e `depto.txt`.</li>
                      <li>Execute a importação dos dados no MGV 7.</li>
                      <li>Transmita a carga de rede para as balanças conectadas.</li>
                    </ul>
                  </div>
                </div>

                {/* Seção 2: Gerenciamento de Taras */}
                <div className="bg-ink-900 border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
                  <div className="flex justify-between items-center border-b border-white/5 pb-4">
                    <h4 className="text-sm text-gold-500 font-bold uppercase tracking-wider">Tabelas de Taras Cadastradas</h4>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTara(null);
                        setTaraForm({ codigo: '', peso: '', descricao: '' });
                        setIsTaraModalOpen(true);
                      }}
                      className="bg-gold-500/10 hover:bg-gold-500 hover:text-ink-950 border border-gold-500/20 text-gold-500 font-black px-4 py-2.5 rounded-xl uppercase tracking-wider text-[10px] transition-all flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Nova Tara
                    </button>
                  </div>

                  {tarasLoading ? (
                    <div className="py-8 text-center text-gray-500">
                      <RefreshCcw className="w-5 h-5 animate-spin mx-auto mb-2 text-gold-500" />
                      Carregando taras...
                    </div>
                  ) : taras.length === 0 ? (
                    <div className="py-12 text-center text-gray-500 italic font-medium">
                      Nenhuma tara de balança cadastrada ainda.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-white/5 text-gray-500 font-black uppercase tracking-wider text-[10px]">
                            <th className="pb-3 px-4">Código (Balança)</th>
                            <th className="pb-3 px-4">Descrição</th>
                            <th className="pb-3 px-4 text-right">Peso (Gramas)</th>
                            <th className="pb-3 px-4 text-right">Peso (Kg)</th>
                            <th className="pb-3 px-4 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-gray-300">
                          {taras.map(tara => (
                            <tr key={tara.id} className="hover:bg-white/5 transition-colors">
                              <td className="py-3 px-4 font-mono font-bold text-white">
                                {tara.codigo.toString().padStart(4, '0')}
                              </td>
                              <td className="py-3 px-4 font-bold text-white">
                                {tara.descricao}
                              </td>
                              <td className="py-3 px-4 text-right font-black text-white">
                                {(Number(tara.peso) * 1000).toFixed(0)}g
                              </td>
                              <td className="py-3 px-4 text-right font-black text-white">
                                {Number(tara.peso).toFixed(3)} kg
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingTara(tara);
                                      setTaraForm({
                                        codigo: tara.codigo.toString(),
                                        peso: (Number(tara.peso) * 1000).toString(),
                                        descricao: tara.descricao
                                      });
                                      setIsTaraModalOpen(true);
                                    }}
                                    className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTara(tara.id)}
                                    className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-red-500 transition-all"
                                  >
                                    Excluir
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* MODAL TARA */}
                {isTaraModalOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div onClick={() => setIsTaraModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                    
                    <motion.div 
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-ink-900 border border-white/10 rounded-[2.5rem] w-full max-w-md p-8 relative z-10 shadow-2xl space-y-6"
                    >
                      <h3 className="text-xl font-display font-bold text-white">
                        {editingTara ? 'Editar Tara' : 'Nova Tara de Balança'}
                      </h3>

                      <form onSubmit={handleSaveTara} className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest block ml-1">Código (Balança)</label>
                          <input
                            type="number"
                            required
                            min={1}
                            max={9999}
                            value={taraForm.codigo}
                            onChange={e => setTaraForm({ ...taraForm, codigo: e.target.value })}
                            placeholder="Ex: 1"
                            className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-gold-500 font-bold"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest block ml-1">Peso (em Gramas)</label>
                          <input
                            type="number"
                            required
                            min={1}
                            value={taraForm.peso}
                            onChange={e => setTaraForm({ ...taraForm, peso: e.target.value })}
                            placeholder="Ex: 40 para uma tara de 40g"
                            className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-gold-500 font-bold"
                          />
                          <p className="text-[9px] text-gray-500 font-normal ml-1">
                            {taraForm.peso ? `Equivale a ${(Number(taraForm.peso) / 1000).toFixed(3)} kg` : ''}
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest block ml-1">Descrição</label>
                          <input
                            type="text"
                            required
                            value={taraForm.descricao}
                            onChange={e => setTaraForm({ ...taraForm, descricao: e.target.value })}
                            placeholder="Ex: Tara Pote 40g"
                            className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-gold-500"
                          />
                        </div>

                        <div className="flex gap-4 pt-4">
                          <button
                            type="button"
                            onClick={() => setIsTaraModalOpen(false)}
                            className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl uppercase tracking-widest text-[10px] transition-all"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            className="flex-1 bg-gold-500 hover:bg-gold-600 text-ink-950 font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] transition-all"
                          >
                            Salvar
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'desktop' && (
              <motion.div
                key="desktop"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div>
                  <h3 className="text-xl font-display font-bold text-white flex items-center gap-2">
                    <Monitor className="text-gold-500 w-6 h-6" /> Aplicativo de Caixa (Windows)
                  </h3>
                  <p className="text-gray-500 text-xs mt-1 font-medium">Instale o PDV diretamente no Windows do caixa para obter máxima estabilidade e recursos nativos de hardware.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-ink-950/40 p-8 rounded-[2.5rem] border border-white/5">
                  <div className="space-y-6 flex flex-col justify-between">
                    <div className="space-y-4">
                      <h4 className="text-sm text-gold-500 font-bold uppercase tracking-wider">Baixar Instalador</h4>
                      <p className="text-xs text-gray-400 leading-relaxed font-medium">
                        Baixe o instalador oficial `.exe` empacotado com Tauri. Ao instalar localmente no computador, o PDV se integra diretamente com a balança e o pin pad Cielo/Gertec PPC930 na porta COM3, eliminando a necessidade de servidores bridge locais.
                      </p>
                      
                      <div className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-2">
                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Informações do Arquivo</p>
                        <ul className="text-xs text-gray-300 space-y-1.5 list-disc list-inside font-medium">
                          <li>Versão Atual: <strong>{desktopRelease?.version || '1.0.0'}</strong></li>
                          <li>Plataforma: <strong>Windows (64-bits)</strong></li>
                          <li>Tamanho: <strong>{desktopRelease?.sizeMb || '~5.4 MB'}</strong> (Ultra Leve)</li>
                          <li>Hospedagem: <strong>GitHub Releases (Oficial)</strong></li>
                        </ul>
                      </div>
                    </div>

                    <a
                      href={desktopRelease?.downloadUrl || "https://github.com/williandaviny/fish-house-desktop/releases"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-gold-500 hover:bg-gold-600 text-ink-950 font-black px-6 py-4 rounded-2xl uppercase tracking-widest text-[11px] transition-all text-center flex items-center justify-center gap-2 shadow-lg shadow-gold-500/5 active:scale-95 mt-4 cursor-pointer"
                    >
                      <Monitor className="w-4 h-4 fill-current" /> Baixar Instalador (.exe)
                    </a>
                  </div>

                  <div className="space-y-5 border-l border-white/5 pl-0 md:pl-8 flex flex-col justify-center">
                    <h5 className="text-xs text-white font-bold uppercase tracking-wider">Benefícios da Versão Desktop:</h5>
                    <ul className="space-y-3.5 text-xs text-gray-400 font-medium">
                      <li className="flex gap-2.5 items-start">
                        <CheckCircle2 className="w-4.5 h-4.5 text-green-500 shrink-0 mt-0.5" />
                        <span><strong>Integração com Pin Pad:</strong> Conecta-se diretamente à porta COM3 do pin pad Cielo PPC930 por cabo USB sem agentes bridge externos.</span>
                      </li>
                      <li className="flex gap-2.5 items-start">
                        <CheckCircle2 className="w-4.5 h-4.5 text-green-500 shrink-0 mt-0.5" />
                        <span><strong>Impressão Térmica Silenciosa:</strong> Envia cupons de comanda e recibos do TEF para a impressora térmica direto, sem abrir a tela de confirmação de impressão do navegador.</span>
                      </li>
                      <li className="flex gap-2.5 items-start">
                        <CheckCircle2 className="w-4.5 h-4.5 text-green-500 shrink-0 mt-0.5" />
                        <span><strong>Modo Tela Cheia Nativo:</strong> Abre como um aplicativo independente de Windows, impedindo que o operador do caixa feche ou saia da tela de vendas acidentalmente.</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Motor de Sincronização Local (Zero Egress / Offline-First) */}
                <div className="bg-ink-950/40 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm text-gold-500 font-bold uppercase tracking-wider flex items-center gap-2">
                        <HardDrive className="w-4 h-4" /> Banco de Dados Local & Sincronização em Nuvem
                      </h4>
                      <p className="text-xs text-gray-400 mt-1">
                        O aplicativo opera com cache local para eliminar custo de Egress e garantir buscas em 0ms no caixa sem depender da internet.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await syncEngine.downloadInitialCatalog(true);
                          if (res.success) {
                            alert(`Catálogo atualizado com sucesso! ${res.count} produtos salvos localmente.`);
                          } else {
                            alert(`Erro ao sincronizar: ${res.error}`);
                          }
                        }}
                        className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-gold-500" /> Baixar Catálogo Completo
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          const res = await syncEngine.syncAll();
                          if (res.success) {
                            alert(`Sincronização concluída! ${res.syncedCount} operações enviadas para a nuvem.`);
                          } else {
                            alert(`Erro ao sincronizar: ${res.error}`);
                          }
                        }}
                        className="px-4 py-2.5 bg-gold-500 hover:bg-gold-600 text-ink-950 font-black rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer"
                      >
                        <CloudUpload className="w-3.5 h-3.5" /> Sincronizar Vendas Agora
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                      <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Produtos no Banco Local</p>
                      <p className="text-xl font-display font-bold text-white mt-1">{localDb.getProducts().length} itens</p>
                    </div>
                    <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                      <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Vendas na Fila Local</p>
                      <p className="text-xl font-display font-bold text-blue-400 mt-1">{localDb.getSyncQueue().length} pendentes</p>
                    </div>
                    <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                      <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Última Sincronização</p>
                      <p className="text-sm font-bold text-emerald-400 mt-1">
                        {localDb.getLastSyncTimestamp() ? new Date(localDb.getLastSyncTimestamp()!).toLocaleTimeString('pt-BR') : 'Ainda não executado'}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
