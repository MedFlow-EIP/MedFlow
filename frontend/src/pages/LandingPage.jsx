import { motion } from "framer-motion";
import { Brain, BookOpen, Stethoscope } from "lucide-react";
import Hero from "../components/Hero";

const features = [
  {
    title: "IA intelligente",
    description:
      "Planification et recommandations basées sur ton rythme d’apprentissage.",
    icon: Brain,
  },
  {
    title: "Cas cliniques",
    description: "Mets en pratique tes connaissances avec des scénarios réalistes.",
    icon: Stethoscope,
  },
  {
    title: "Flashcards dynamiques",
    description: "Générées automatiquement à partir de tes notes de cours.",
    icon: BookOpen,
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Hero */}
      <Hero />

      {/* Pourquoi MedFlow */}
      <motion.section
        id="why"
        className="relative py-20 px-6 text-center"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-3xl md:text-4xl font-bold mb-6">
          Pourquoi MedFlow ?
        </h2>
        <p className="max-w-2xl mx-auto text-lg text-gray-600 dark:text-gray-300">
          Une plateforme qui combine <span className="font-semibold">IA</span> et{" "}
          <span className="font-semibold">neurosciences</span> pour maximiser la
          rétention, économiser du temps et rendre les révisions médicales plus
          efficaces.
        </p>
      </motion.section>

      {/* Fonctionnalités */}
      <motion.section
        id="features"
        className="py-20 px-6"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-10 text-center">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="relative p-8 bg-gray-50 dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition cursor-default"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
            >
              <feature.icon className="w-12 h-12 mx-auto mb-6 text-blue-600 dark:text-blue-400" />
              <h3 className="text-2xl font-semibold mb-4">
                {feature.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <motion.section
        className="relative py-20 text-center overflow-hidden bg-gray-50 dark:bg-gray-800"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <h2 className="text-3xl md:text-4xl font-bold mb-4 relative z-10">
          Prêt à transformer ta façon d’apprendre ?
        </h2>
        <p className="mb-6 text-lg text-gray-600 dark:text-gray-300 relative z-10">
          Rejoins les étudiants en médecine qui révisent plus efficacement avec
          MedFlow.
        </p>
        <motion.button
          whileHover={{ scale: 1.05 }}
          className="px-8 py-4 bg-blue-600 text-white font-semibold rounded-xl shadow-lg hover:bg-blue-700 transition relative z-10"
        >
          Essayer gratuitement
        </motion.button>
      </motion.section>
    </div>
  );
}
