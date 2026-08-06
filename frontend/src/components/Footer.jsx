import { Facebook, Twitter, Instagram, Linkedin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
      <div className="max-w-7xl mx-auto px-6 py-12 grid md:grid-cols-4 gap-10">
        {/* Logo + Description */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            MedFlow
          </h2>
          <p className="text-sm leading-relaxed">
            L’application intelligente qui combine IA et neurosciences pour
            optimiser vos révisions médicales.
          </p>
        </div>

        {/* Navigation */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Navigation
          </h3>
          <ul className="space-y-2 text-sm">
            <li><a href="#features" className="hover:text-blue-600 dark:hover:text-blue-400">Fonctionnalités</a></li>
            <li><a href="#pricing" className="hover:text-blue-600 dark:hover:text-blue-400">Tarifs</a></li>
            <li><a href="#about" className="hover:text-blue-600 dark:hover:text-blue-400">À propos</a></li>
            <li><a href="#contact" className="hover:text-blue-600 dark:hover:text-blue-400">Contact</a></li>
          </ul>
        </div>

        {/* Mentions légales */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Informations légales
          </h3>
          <ul className="space-y-2 text-sm">
            <li><a href="/privacy" className="hover:text-blue-600 dark:hover:text-blue-400">Politique de confidentialité</a></li>
            <li><a href="/terms" className="hover:text-blue-600 dark:hover:text-blue-400">CGU / CGV</a></li>
            <li><a href="/cookies" className="hover:text-blue-600 dark:hover:text-blue-400">Gestion des cookies</a></li>
          </ul>
        </div>

        {/* Réseaux sociaux */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Suivez-nous
          </h3>
          <div className="flex space-x-4">
            <a href="#" className="hover:text-blue-600 dark:hover:text-blue-400"><Facebook size={20} /></a>
            <a href="#" className="hover:text-blue-600 dark:hover:text-blue-400"><Twitter size={20} /></a>
            <a href="#" className="hover:text-blue-600 dark:hover:text-blue-400"><Instagram size={20} /></a>
            <a href="#" className="hover:text-blue-600 dark:hover:text-blue-400"><Linkedin size={20} /></a>
          </div>
        </div>
      </div>

      {/* Bas de page */}
      <div className="border-t border-gray-300 dark:border-gray-700 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
        © {new Date().getFullYear()} MedFlow. Tous droits réservés.
      </div>
    </footer>
  );
}
