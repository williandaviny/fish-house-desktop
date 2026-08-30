import Hero from '../components/Hero';
import Features from '../components/Features';
import Combos from '../components/Combos';
import Catalog from '../components/Catalog';
import About from '../components/About';
import Testimonials from '../components/Testimonials';
import Blog from '../components/Blog';
import FinalCTA from '../components/FinalCTA';

export default function Home() {
  return (
    <main>
      <Hero />
      <Features />
      <Combos />
      <Catalog limit={3} showButton={true} />
      <About />
      <Testimonials />
      <Blog />
      <FinalCTA />
    </main>
  );
}
