/**
 * Utilitário para otimização de imagens e economia de banda (Egress)
 * Esta função redireciona as URLs do Supabase para o seu Proxy no Cloudflare.
 */
export function getOptimizedImageUrl(url: string | null | undefined): string {
  if (!url) return 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&q=80';
  
  // Retornamos a URL direta do Supabase. Como otimizamos todas as imagens do bucket de 231MB
  // para apenas 5.3MB (~45KB por imagem), o consumo de egress não é mais um problema.
  // Isso também contorna o erro 530/1016 de DNS do Cloudflare no proxy '/storage/*'.
  return url;
}
