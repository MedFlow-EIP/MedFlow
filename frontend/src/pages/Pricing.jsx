import { motion } from "framer-motion";

export default function Pricing() {
  return (
    <section className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-6">
      <motion.div
        className="text-center w-full max-w-5xl"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-4xl font-bold mb-10">Nos Tarifs</h2>
        <div className="grid md:grid-cols-3 gap-8">
          
          {/* Gratuit */}
          <motion.div
            className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow hover:shadow-lg bg-white dark:bg-gray-800"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <h3 className="text-2xl font-semibold mb-4">Gratuit</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Accès limité aux fonctionnalités
            </p>
            <p className="text-3xl font-bold">0€</p>
          </motion.div>

          {/* Premium */}
          <motion.div
            className="
              border border-blue-600 dark:border-blue-400
              rounded-xl p-6 shadow-lg
              bg-blue-600 text-white
              dark:bg-gradient-to-r dark:from-blue-700 dark:to-indigo-700
              hover:shadow-xl transition
            "
            whileHover={{ scale: 1.08 }}
            transition={{ type: "spring", stiffness: 250 }}
          >
            <h3 className="text-2xl font-semibold mb-4">Premium</h3>
            <p className="mb-4">Tout MedFlow sans limite</p>
            <p className="text-3xl font-bold">3,99€/mois</p>
          </motion.div>

          {/* Université */}
          <motion.div
            className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow hover:shadow-lg bg-white dark:bg-gray-800"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <h3 className="text-2xl font-semibold mb-4">Forfait Université</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Accès collectif pour étudiants
            </p>
            <p className="text-3xl font-bold">19,99€/an</p>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
