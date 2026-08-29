import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Clock, Calendar, Tag, Share2, Facebook, Twitter, Link2 } from 'lucide-react';

const posts = {
    'como-limpar-peixe-fresco-em-casa': {
        title: 'Como limpar peixe fresco em casa',
        category: 'Dicas Práticas',
        image: 'https://images.unsplash.com/photo-1580476262798-bddd9f4b7369?q=80&w=1200&auto=format&fit=crop',
        readTime: '3 min',
        date: '10 de Março, 2026',
        content: (
            <>
                <p className="text-xl text-gray-400 mb-8 leading-relaxed">
                    Limpar um peixe fresco pode parecer um desafio para quem não tem prática, mas com as ferramentas certas e o passo a passo adequado, você garante o melhor sabor e textura para sua receita.
                </p>

                <h2 className="text-3xl font-display font-bold mb-6 text-white">1. Preparação é tudo</h2>
                <p className="mb-6">
                    Antes de começar, certifique-se de ter uma tábua de corte firme, uma faca de filetagem bem afiada e um descamador (ou uma faca cega para essa função). Mantenha água corrente por perto para higienizar o peixe durante o processo.
                </p>

                <div className="bg-ink-800/50 border-l-4 border-gold-500 p-6 rounded-r-2xl mb-8">
                    <p className="italic text-gray-300">
                        "O frescor é o ingrediente mais importante. No Fish House, selecionamos nossos peixes diariamente para que você receba sempre o melhor em sua casa."
                    </p>
                </div>

                <h2 className="text-3xl font-display font-bold mb-6 text-white">2. Retirando as escamas</h2>
                <p className="mb-6">
                    Segure o peixe firmemente pela cauda e use o descamador no sentido contrário ao das escamas (da cauda para a cabeça). Faça movimentos curtos e firmes. Dica extra: faça isso dentro de um saco plástico grande ou submerso em uma bacia com água para evitar que as escamas voem pela cozinha.
                </p>

                <img
                    src="https://images.unsplash.com/photo-1524704606729-374e241bc910?q=80&w=800&auto=format&fit=crop"
                    alt="Limpando peixe"
                    className="rounded-3xl w-full aspect-video object-cover mb-8 shadow-2xl"
                />

                <h2 className="text-3xl font-display font-bold mb-6 text-white">3. Evisceração e Limpeza Final</h2>
                <p className="mb-6">
                    Faça um corte longitudinal na barriga do peixe, começando pelo orifício anal até a base da cabeça. Retire as vísceras com cuidado. Lave bem o interior sob água corrente fria, removendo qualquer resquício de sangue na espinha central.
                </p>

                <p>
                    Agora seu peixe está pronto para ser marinado ou ir direto para a grelha! Lembre-se que a simplicidade costuma ser a melhor amiga do peixe fresco: sal, limão e um bom azeite são suficientes para exaltar o sabor do mar.
                </p>
            </>
        )
    },
    'receita-camarao-na-moranga': {
        title: 'A receita perfeita de Camarão na Moranga',
        category: 'Receitas',
        image: 'https://images.unsplash.com/photo-1551248429-40975aa4de74?q=80&w=1200&auto=format&fit=crop',
        readTime: '5 min',
        date: '08 de Março, 2026',
        content: (
            <>
                <p className="text-xl text-gray-400 mb-8 leading-relaxed">
                    Um clássico da culinária litorânea que impressiona pela apresentação e conquista pelo sabor cremoso. Aprenda os segredos para a moranga ficar no ponto certo e o camarão suculento.
                </p>

                <h2 className="text-3xl font-display font-bold mb-6 text-white">Ingredientes Premium</h2>
                <ul className="list-disc list-inside space-y-3 mb-8 text-gray-300">
                    <li>1 moranga média</li>
                    <li>1kg de camarão médio limpo (Fish House Select)</li>
                    <li>400g de requeijão cremoso de boa qualidade</li>
                    <li>2 cebolas médias picadas</li>
                    <li>3 dentes de alho amassados</li>
                    <li> Azeite de oliva extra virgem</li>
                    <li>Sal, pimenta e coentro a gosto</li>
                </ul>

                <h2 className="text-3xl font-display font-bold mb-6 text-white">Modo de Preparo</h2>
                <p className="mb-6">
                    Comece preparando a moranga: corte a tampa, retire as sementes e pincele azeite por dentro e por fora. Envolva em papel alumínio e leve ao forno médio por cerca de 45 minutos ou até que a polpa esteja macia, mas a casca ainda firme.
                </p>

                <div className="grid grid-cols-2 gap-4 mb-8">
                    <img
                        src="https://images.unsplash.com/photo-1559739511-30c1e8784d85?q=80&w=400&auto=format&fit=crop"
                        alt="Ingredientes camarão"
                        className="rounded-2xl w-full h-48 object-cover"
                    />
                    <img
                        src="https://images.unsplash.com/photo-1551248429-40975aa4de74?q=80&w=400&auto=format&fit=crop"
                        alt="Camarão sendo preparado"
                        className="rounded-2xl w-full h-48 object-cover"
                    />
                </div>

                <p className="mb-6">
                    Enquanto isso, refogue a cebola e o alho no azeite. Adicione os camarões e cozinhe por apenas 2 a 3 minutos para não ficarem borrachudos. Adicione o molho de tomate (opcional), ajuste o sal e a pimenta. Desligue o fogo e misture o requeijão.
                </p>

                <p>
                    Finalize recheando a moranga, coloque a tampa e leve ao forno por mais 10 minutos apenas para gratinar. Sirva com arroz branco soltinho e batata palha artesanal.
                </p>
            </>
        )
    },
    'como-conservar-frutos-do-mar-congelados': {
        title: 'Como conservar frutos do mar congelados',
        category: 'Conservação',
        image: 'https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?q=80&w=1200&auto=format&fit=crop',
        readTime: '4 min',
        date: '05 de Março, 2026',
        content: (
            <>
                <p className="text-xl text-gray-400 mb-8 leading-relaxed">
                    Saber congelar e, principalmente, descongelar corretamente os frutos do mar é essencial para manter o sabor Original e a segurança alimentar da sua família.
                </p>

                <h2 className="text-3xl font-display font-bold mb-6 text-white">A Regra de Ouro do Descongelamento</h2>
                <p className="mb-6">
                    Nunca descongele frutos do mar em temperatura ambiente ou em água morna. O processo ideal deve ser lento: retire do freezer e coloque na parte de baixo da geladeira 24 horas antes do preparo.
                </p>

                <h2 className="text-3xl font-display font-bold mb-6 text-white">Dicas por tipo de produto</h2>
                <div className="space-y-6 mb-8">
                    <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                        <h3 className="text-gold-400 font-bold mb-2">Camarões</h3>
                        <p className="text-sm">Podem ser congelados com ou sem casca. Se for congelar em casa, tente remover o máximo de ar possível da embalagem.</p>
                    </div>
                    <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                        <h3 className="text-gold-400 font-bold mb-2">Peixes em Filé</h3>
                        <p className="text-sm">O ideal é embalar a vácuo. Se não for possível, envolva em filme plástico bem apertado e depois em papel alumínio.</p>
                    </div>
                </div>

                <p>
                    Lembre-se: uma vez descongelado, o produto não deve voltar ao freezer. Por isso, congele sempre em porções individuais que serão consumidas de uma só vez.
                </p>
            </>
        )
    }
};

export default function BlogPost() {
    const { slug } = useParams();
    const post = posts[slug as keyof typeof posts];

    if (!post) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-ink-900 text-white p-4">
                <div className="text-center">
                    <h1 className="text-4xl font-display font-bold mb-4">Artigo não encontrado</h1>
                    <Link to="/" className="text-gold-500 hover:text-gold-400 font-semibold inline-flex items-center gap-2">
                        <ArrowLeft className="w-5 h-5" />
                        Voltar para a Home
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-ink-900 min-h-screen">
            {/* Hero Section */}
            <section className="relative h-[60vh] md:h-[70vh] w-full overflow-hidden">
                <motion.img
                    initial={{ scale: 1.1, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 1.5 }}
                    src={post.image}
                    alt={post.title}
                    className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/40 to-transparent" />

                <div className="absolute inset-0 flex items-end">
                    <div className="max-w-4xl mx-auto px-4 w-full pb-16 md:pb-24">
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                        >
                            <Link to="/" className="inline-flex items-center gap-2 text-gold-500 hover:text-gold-400 font-semibold mb-8 transition-all hover:-translate-x-1">
                                <ArrowLeft className="w-5 h-5" />
                                Dicas e Receitas
                            </Link>
                            <div className="flex flex-wrap items-center gap-4 mb-6">
                                <span className="bg-gold-500/20 backdrop-blur-md text-gold-500 border border-gold-500/20 px-4 py-1.5 rounded-full text-sm font-bold tracking-wider uppercase">
                                    {post.category}
                                </span>
                                <div className="flex items-center gap-2 text-gray-400 text-sm">
                                    <Clock className="w-4 h-4" />
                                    <span>{post.readTime}</span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-400 text-sm">
                                    <Calendar className="w-4 h-4" />
                                    <span>{post.date}</span>
                                </div>
                            </div>
                            <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold text-white leading-[1.1] tracking-tight">
                                {post.title}
                            </h1>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Content Section */}
            <section className="py-20 bg-ink-900 relative">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid lg:grid-cols-[1fr_300px] gap-16">

                        {/* Article Content */}
                        <motion.article
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.8 }}
                            className="prose prose-invert prose-gold max-w-none text-gray-300"
                        >
                            {post.content}

                            <div className="mt-16 pt-8 border-t border-white/10 flex flex-wrap items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <span className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Compartilhar:</span>
                                    <div className="flex items-center gap-2">
                                        <button className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-gold-500 hover:text-white transition-all">
                                            <Facebook className="w-5 h-5" />
                                        </button>
                                        <button className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-gold-500 hover:text-white transition-all">
                                            <Twitter className="w-5 h-5" />
                                        </button>
                                        <button className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-gold-500 hover:text-white transition-all">
                                            <Link2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Tag className="w-5 h-5 text-gold-500" />
                                    <span className="text-sm text-gray-400">#FishHouse #Gastronomia #PeixesFrescos</span>
                                </div>
                            </div>
                        </motion.article>

                        {/* Sidebar */}
                        <aside className="space-y-12">
                            <div className="bg-ink-800/40 border border-white/5 rounded-3xl p-8 sticky top-32">
                                <h3 className="text-2xl font-display font-bold text-white mb-6">Sobre a Fish House</h3>
                                <p className="text-gray-400 text-sm leading-relaxed mb-6">
                                    Desde 2025 trazendo o frescor do mar direto para a mesa da família navegantina. Qualidade e procedência garantida.
                                </p>
                                <Link to="/catalogo" className="flex items-center justify-center gap-2 bg-gold-500 text-ink-900 py-3 rounded-full font-bold transition-all hover:scale-105 active:scale-95">
                                    Ver nosso Catálogo
                                </Link>
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-xl font-display font-bold text-white">Mais Lidos</h3>
                                {Object.entries(posts).filter(([s]) => s !== slug).map(([s, p], i) => (
                                    <Link key={i} to={`/blog/${s}`} className="group flex gap-4">
                                        <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0">
                                            <img src={p.image} alt={p.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-white group-hover:text-gold-500 transition-colors line-clamp-2 leading-snug">
                                                {p.title}
                                            </h4>
                                            <p className="text-xs text-gray-500 mt-1">{p.readTime}</p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </aside>

                    </div>
                </div>
            </section>
        </div>
    );
}
