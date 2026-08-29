import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export type OpeningHour = {
  day: number;
  open: string;
  close: string;
  closed: boolean;
};

export type SiteSettings = {
  id: string;
  store_name: string;
  cnpj: string;
  whatsapp: string;
  contact_email: string;
  contact_phone: string;
  address_street: string;
  address_number: string;
  address_neighborhood: string;
  address_city: string;
  opening_hours: OpeningHour[];
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
  delivery_fee: number;
  credit_card_enabled: boolean;
  pix_enabled: boolean;
  special_dates?: any[];
  wholesale_discount_type?: string;
  wholesale_discount_value?: number;
};

export function useSettings() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('id, store_name, cnpj, whatsapp, contact_email, contact_phone, address_street, address_number, address_neighborhood, address_city, opening_hours, tracking_gtm, tracking_pixel, tracking_gads, label_config, categories, mercadopago_enabled, mercadopago_public_key, mercadopago_access_token, active_payment_gateway, pagbank_enabled, pagbank_environment, pagbank_token, pagbank_public_key, pix_discount_enabled, pix_discount_percent, delivery_fee, credit_card_enabled, pix_enabled, special_dates, wholesale_discount_type, wholesale_discount_value')
          .limit(1)
          .single();

        if (!error && data) {
          setSettings(data);
        }
      } catch (err) {
        console.error('Error in useSettings:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, []);

  return { settings, loading };
}
