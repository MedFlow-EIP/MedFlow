import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function Hero() {
  return (
    <section
      className="
        relative 
        bg-white dark:bg-gray-900 
        text-gray-900 dark:text-white 
        overflow-hidden
      "
    >
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5 dark:opacity-10" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-24 md:py-32 grid md:grid-cols-2 gap-12 items-center">
        <div className="text-center md:text-left">
          <motion.h1
            className="text-4xl md:text-6xl font-extrabold leading-tight mb-6"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            Réinventez vos{" "}
            <span
              className="
                relative
                after:content-['']
                after:absolute after:left-0 after:bottom-0
                after:w-full after:h-[6px]
                after:bg-gradient-to-r after:from-blue-400 after:to-indigo-500
                after:rounded
              "
            >
              révisions médicales
            </span>{" "}
            avec{" "}
            <span className="text-blue-600 dark:text-blue-400">MedFlow</span>
          </motion.h1>

          <motion.p
            className="max-w-xl mx-auto md:mx-0 text-lg text-gray-600 dark:text-gray-300 mb-10"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            Une application intelligente qui combine{" "}
            <span className="font-semibold">IA</span> et{" "}
            <span className="font-semibold">neurosciences</span> pour booster ta
            mémoire : flashcards dynamiques, cas cliniques interactifs et
            planification optimisée.
          </motion.p>

          {/* CTA */}
          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
          >
            <Link
            to="/register"
            className="flex items-center justify-center gap-2 px-6 py-3 
                        bg-gradient-to-r from-blue-600 to-indigo-600 
                        text-white font-semibold rounded-lg shadow-lg 
                        hover:from-blue-700 hover:to-indigo-700 
                        hover:scale-105 hover:shadow-xl transition
                        drop-shadow-md"
            >
            Commencer dès maintenant
            <ArrowRight className="w-5 h-5" />
            </Link>

            <Link
              to="#features"
              className="flex items-center justify-center px-6 py-3 
                         border border-gray-300 dark:border-gray-600 
                         rounded-lg font-semibold 
                         hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              Découvrir les fonctionnalités
            </Link>
          </motion.div>
        </div>

        <motion.div
          className="relative"
          initial={{ opacity: 0, scale: 0.9, y: 40 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6, duration: 0.7 }}
        >
          {/* Fond qui s’adapte au mode */}
          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-2xl shadow-2xl">
            {/* Conteneur blanc pour l’image */}
              <img
                src="/images/app-mockup.png"
                alt="Mockup MedFlow"
                className="w-full rounded-md"
              />
          </div>
        </motion.div>

      </div>
    </section>
  );
}
