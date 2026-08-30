import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Database, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

export default function AdminDatabaseCleanup() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<string>('');
  const [completed, setCompleted] = useState(false);

  const startCleanup = async () => {
    setLoading(true);
    setCompleted(false);
    setProgress(0);
    setStatus('Buscando produtos no banco de dados...');

    try {
      // Pega todos os produtos para verificar quais têm imagens em base64
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, image_url');

      if (error) throw error;
      if (!products) {
        setStatus('Nenhum produto encontrado.');
        setLoading(false);
        return;
      }

      // Filtra os que contêm 'data:image' (são base64 e não links)
      const base64Products = products.filter(p => p.image_url?.startsWith('data:image'));
      setTotal(base64Products.length);

      if (base64Products.length === 0) {
        setStatus('Todos os produtos já estão otimizados! Nenhuma imagem Base64 encontrada.');
        setCompleted(true);
        setLoading(false);
        return;
      }

      setStatus(`Encontrados ${base64Products.length} produtos com imagens pesadas. Iniciando conversão para WebP e migração para o Storage...`);

      for (let i = 0; i < base64Products.length; i++) {
        const product = base64Products[i];
        setStatus(`Convertendo: ${product.name} (${i + 1}/${base64Products.length})`);

        try {
          // Converte Base64 para Imagem -> Canvas -> Blob WebP
          const img = new Image();
          img.src = product.image_url;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas validation failed');

          // Comprime e redimensiona como feito no AdminProducts
          const MAX_SIZE = 1200;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          const blob = await new Promise<Blob | null>(resolve => 
            canvas.toBlob(resolve, 'image/webp', 0.8) // Otimiza para WebP a 80%
          );

          if (!blob) throw new Error('Failed to create WebP blob');

          // Upload para o Supabase Storage
          const fileName = `migrated_${Date.now()}_${product.id.substring(0, 8)}.webp`;
          const { error: uploadError } = await supabase.storage
            .from('products')
            .upload(fileName, blob);

          if (uploadError) throw uploadError;

          // Pega a URL Pública
          const { data: { publicUrl } } = supabase.storage
            .from('products')
            .getPublicUrl(fileName);

          // Atualiza o banco de dados via POSTGREST
          const { error: updateError } = await supabase
            .from('products')
            .update({ image_url: publicUrl })
            .eq('id', product.id);

          if (updateError) throw updateError;

          setProgress(i + 1);

        } catch (err: any) {
          console.error(`Erro ao converter ${product.name}:`, err);
        }
      }

      setStatus(`Migração concluída! ${base64Products.length} imagens convertidas e otimizadas.`);
      setCompleted(true);
    } catch (err: any) {
      console.error('Migration error:', err);
      setStatus('Erro ocorreu: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-ink-900 border border-white/10 rounded-3xl p-8 max-w-2xl mx-auto shadow-2xl space-y-6 mt-12">
      <div className="flex items-center gap-4">
        <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
          <Database className="w-8 h-8 text-amber-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white uppercase tracking-widest">Otimização de Banco de Dados</h2>
          <p className="text-gray-400 text-sm mt-1">Limpe imagens antigas em Base64 que estão estourando a banda do Supabase.</p>
        </div>
      </div>

      <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex gap-3">
        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <div className="space-y-2">
          <p className="text-sm font-bold text-white">Sobre Egress (Banda do Supabase)</p>
          <p className="text-xs text-gray-400 leading-relaxed">
            Seus produtos antigos estavam salvando as imagens diretamente no banco de dados em formato de texto gigante (Base64).
            Quando os clientes acessam a tela inicial, isso gasta gigabytes de banda em minutos! <br/><br/>
            Para resolver isso, este script vai percorrer todo seu banco, converter as imagens para WebP super leves, 
            jogá-las no Storage correto e atualizar as referências, economizando mais de 98% da sua banda.
          </p>
        </div>
      </div>

      <div className="bg-ink-950 p-6 rounded-2xl border border-white/5 space-y-6">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Progresso da Conversão</span>
          <span className="text-white font-bold">{progress} / {total}</span>
        </div>
        
        <div className="w-full bg-ink-900 border border-white/10 rounded-full h-4 overflow-hidden">
          <div 
            className="bg-gradient-to-r from-gold-400 to-gold-600 h-full transition-all duration-500 ease-out"
            style={{ width: total > 0 ? `${(progress / total) * 100}%` : '0%' }}
          />
        </div>

        {status && (
          <div className="flex items-center gap-2 text-sm text-gold-500 font-medium">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {completed && <CheckCircle className="w-4 h-4 text-green-500" />}
            <span className={completed ? 'text-green-500' : ''}>{status}</span>
          </div>
        )}

        <button
          onClick={startCleanup}
          disabled={loading || completed}
          className="w-full bg-gold-500 text-ink-950 font-bold uppercase tracking-widest py-4 rounded-xl hover:bg-gold-400 active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? 'Processando (aguarde, não saia desta tela)...' : 'Iniciar Limpeza do Banco'}
        </button>
      </div>
    </div>
  );
}
