import { motion } from 'motion/react';
import { BookOpen, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const posts = [
  {
    title: 'Como limpar peixe fresco em casa',
    slug: 'como-limpar-peixe-fresco-em-casa',
    category: 'Dicas Práticas',
    image: 'https://images.unsplash.com/photo-1580476262798-bddd9f4b7369?q=80&w=800&auto=format&fit=crop',
    readTime: '3 min',
  },
  {
    title: 'A receita perfeita de Camarão na Moranga',
    slug: 'receita-camarao-na-moranga',
    category: 'Receitas',
    image: 'https://images.unsplash.com/photo-1551248429-40975aa4de74?q=80&w=800&auto=format&fit=crop',
    readTime: '5 min',
  },
  {
    title: 'Como conservar frutos do mar congelados',
    slug: 'como-conservar-frutos-do-mar-congelados',
    category: 'Conservação',
    image: 'https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?q=80&w=800&auto=format&fit=crop',
    readTime: '4 min',
  },
];

export default function Blog() {
  return (
    <section id="blog" className="py-24 bg-ink-900 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
          <div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-6 tracking-tight"
            >
              Receitas e <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-400 to-gold-600">Dicas</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-lg text-gray-400 max-w-2xl"
            >
              Aprenda a preparar os melhores pratos e descubra segredos para manter o frescor dos seus produtos.
            </motion.p>
          </div>

          <Link to="/blog" className="hidden md:flex items-center gap-2 text-gold-500 hover:text-gold-400 font-semibold transition-all hover:scale-105 active:scale-95">
            Ver todas as dicas
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={{
            visible: {
              transition: {
                staggerChildren: 0.15
              }
            }
          }}
          className="grid md:grid-cols-3 gap-8"
        >
          {posts.map((post, i) => (
            <motion.div
              key={i}
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: { opacity: 1, y: 0 }
              }}
            >
              <Link
                to={`/blog/${post.slug}`}
                className="block group bg-ink-800/30 p-4 rounded-3xl border border-white/5 hover:border-gold-500/20 transition-all duration-500 hover:bg-ink-800/50 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(207,161,74,0.1)] h-full"
              >
                <div className="relative h-64 rounded-2xl overflow-hidden mb-6 shadow-lg">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-4 left-4 bg-ink-900/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-gold-500 border border-white/10">
                    {post.category}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-gray-500 text-sm mb-3">
                  <BookOpen className="w-4 h-4" />
                  <span>{post.readTime} de leitura</span>
                </div>

                <h3 className="text-xl font-bold text-white font-display group-hover:text-gold-500 transition-colors leading-snug">
                  {post.title}
                </h3>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <div className="mt-10 text-center md:hidden">
          <Link to="/blog" className="inline-flex items-center gap-2 text-gold-500 hover:text-gold-400 font-semibold transition-all hover:scale-105 active:scale-95">
            Ver todas as dicas
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>

      </div>
    </section>
  );
}
