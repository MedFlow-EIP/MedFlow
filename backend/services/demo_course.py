"""Cours d'exemple, déjà généré, pour découvrir MedFlow sans importer de PDF.

Un nouvel utilisateur peut réviser tout de suite (et hors ligne) au lieu
d'attendre la génération de son premier cours. Contenu écrit à la main,
sans appel à l'IA.
"""

DEMO_COURSE_ID = "exemple-cycle-cardiaque"

DEMO_COURSE = {
    "nom": "Exemple : le cycle cardiaque",
    "tags": ["Cardiologie"],
    "summary": (
        "<h2>Le cycle cardiaque</h2>"
        "<p>Le cycle cardiaque est la succession d'une phase de contraction (systole) et d'une phase "
        "de relâchement (diastole) des ventricules. Au repos, il dure environ 0,8 seconde pour une "
        "fréquence de 75 battements par minute.</p>"
        "<h3>La systole ventriculaire</h3>"
        "<ul>"
        "<li><strong>Contraction isovolumétrique</strong> : les ventricules se contractent alors que les "
        "valves auriculo-ventriculaires (mitrale, tricuspide) et sigmoïdes (aortique, pulmonaire) sont "
        "fermées. La pression monte sans que le volume change.</li>"
        "<li><strong>Éjection</strong> : quand la pression ventriculaire dépasse la pression artérielle, "
        "les valves sigmoïdes s'ouvrent et le sang est éjecté dans l'aorte et l'artère pulmonaire.</li>"
        "</ul>"
        "<h3>La diastole ventriculaire</h3>"
        "<ul>"
        "<li><strong>Relaxation isovolumétrique</strong> : toutes les valves sont fermées, la pression "
        "ventriculaire chute.</li>"
        "<li><strong>Remplissage</strong> : les valves auriculo-ventriculaires s'ouvrent. Le remplissage "
        "est d'abord rapide et passif, puis la contraction des oreillettes (systole auriculaire) le "
        "complète.</li>"
        "</ul>"
        "<h3>Les bruits du cœur</h3>"
        "<ul>"
        "<li><strong>B1</strong> : fermeture des valves auriculo-ventriculaires, au début de la systole.</li>"
        "<li><strong>B2</strong> : fermeture des valves sigmoïdes, au début de la diastole.</li>"
        "</ul>"
        "<h3>Repères chiffrés</h3>"
        "<ul>"
        "<li>Volume d'éjection systolique : environ 70 mL au repos.</li>"
        "<li>Débit cardiaque = fréquence cardiaque × volume d'éjection systolique, soit environ "
        "5 L/min au repos.</li>"
        "<li>Fraction d'éjection du ventricule gauche : normale au-dessus de 50 %.</li>"
        "</ul>"
        "<p>Ce cours d'exemple sert à découvrir MedFlow. Importe tes propres cours pour réviser ton "
        "programme.</p>"
    ),
    "flashcards": [
        {"question": "Qu'est-ce que la systole ventriculaire ?",
         "answer": "La phase de contraction des ventricules, qui éjecte le sang dans les artères."},
        {"question": "Qu'est-ce que la diastole ventriculaire ?",
         "answer": "La phase de relâchement des ventricules, pendant laquelle ils se remplissent."},
        {"question": "Quelles valves sont fermées pendant la contraction isovolumétrique ?",
         "answer": "Toutes : les valves auriculo-ventriculaires et les valves sigmoïdes."},
        {"question": "Quand les valves sigmoïdes s'ouvrent-elles ?",
         "answer": "Quand la pression ventriculaire dépasse la pression dans l'aorte (ou l'artère pulmonaire)."},
        {"question": "À quoi correspond le bruit B1 ?",
         "answer": "À la fermeture des valves auriculo-ventriculaires (mitrale et tricuspide), au début de la systole."},
        {"question": "À quoi correspond le bruit B2 ?",
         "answer": "À la fermeture des valves sigmoïdes (aortique et pulmonaire), au début de la diastole."},
        {"question": "Comment calcule-t-on le débit cardiaque ?",
         "answer": "Fréquence cardiaque × volume d'éjection systolique (environ 5 L/min au repos)."},
        {"question": "Quel est le rôle de la systole auriculaire ?",
         "answer": "Compléter le remplissage des ventricules à la fin de la diastole."},
    ],
    "quiz": [
        {
            "question": "Pendant la contraction isovolumétrique, quelles valves sont ouvertes ?",
            "options": {"A": "Aucune", "B": "Les valves mitrale et tricuspide", "C": "Les valves aortique et pulmonaire",
                        "D": "Toutes les valves"},
            "correct": "A",
            "explanation": "Toutes les valves sont fermées : la pression monte dans les ventricules sans changement de volume.",
        },
        {
            "question": "Quel événement produit le bruit B2 ?",
            "options": {"A": "L'ouverture des valves sigmoïdes", "B": "La fermeture des valves auriculo-ventriculaires",
                        "C": "La fermeture des valves sigmoïdes", "D": "La contraction des oreillettes"},
            "correct": "C",
            "explanation": "B2 marque la fermeture des valves aortique et pulmonaire, au début de la diastole.",
        },
        {
            "question": "Avec une fréquence de 70 battements/min et un volume d'éjection de 70 mL, le débit cardiaque vaut environ :",
            "options": {"A": "1 L/min", "B": "4,9 L/min", "C": "10 L/min", "D": "70 L/min"},
            "correct": "B",
            "explanation": "70 × 70 mL = 4 900 mL/min, soit environ 4,9 L/min.",
        },
        {
            "question": "Qu'est-ce qui déclenche l'ouverture des valves sigmoïdes ?",
            "options": {"A": "La contraction des oreillettes",
                        "B": "Une pression ventriculaire supérieure à la pression artérielle",
                        "C": "La fermeture de la valve mitrale", "D": "Le remplissage passif des ventricules"},
            "correct": "B",
            "explanation": "Les valves s'ouvrent passivement quand la pression en amont (ventricule) dépasse la pression en aval (artère).",
        },
        {
            "question": "À quel moment se produit la systole auriculaire ?",
            "options": {"A": "Au début de la systole ventriculaire", "B": "Pendant l'éjection",
                        "C": "À la fin de la diastole ventriculaire", "D": "Pendant la relaxation isovolumétrique"},
            "correct": "C",
            "explanation": "La contraction des oreillettes complète le remplissage, juste avant la systole ventriculaire suivante.",
        },
        {
            "question": "Quelle fraction d'éjection du ventricule gauche est considérée comme normale ?",
            "options": {"A": "Moins de 30 %", "B": "Environ 40 %", "C": "Au-dessus de 50 %", "D": "100 %"},
            "correct": "C",
            "explanation": "Une fraction d'éjection du ventricule gauche au-dessus de 50 % est considérée comme normale.",
        },
    ],
}
