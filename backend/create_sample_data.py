#!/usr/bin/env python3
"""
Create sample data for testing the course persistence functionality
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from app import save_course

def create_sample_courses():
    """Create sample courses for testing"""
    print("Creating sample course data...")
    
    # Sample user UID (you can replace this with a real Firebase UID)
    sample_uid = "sample-user-12345"
    
    # Sample course 1: Cardiology
    course1 = {
        "nom": "Cardiologie - Les Bases",
        "summary": """
        <h2>Introduction à la Cardiologie</h2>
        <p>Ce cours couvre les concepts fondamentaux de la cardiologie, incluant:</p>
        <ul>
            <li>Anatomie du système cardiovasculaire</li>
            <li>Physiologie cardiaque</li>
            <li>Pathologies courantes</li>
            <li>Méthodes de diagnostic</li>
        </ul>
        <h3>Objectifs d'apprentissage</h3>
        <p>À la fin de ce cours, vous devriez être capable de comprendre les mécanismes de base du fonctionnement cardiaque.</p>
        """,
        "flashcards": [
            {
                "question": "Quelle est la fonction principale du ventricule gauche?",
                "answer": "Pomper le sang oxygéné vers la circulation systémique"
            },
            {
                "question": "Qu'est-ce que la fraction d'éjection?",
                "answer": "Le pourcentage de sang éjecté du ventricule gauche à chaque battement"
            },
            {
                "question": "Quels sont les principaux signes d'insuffisance cardiaque?",
                "answer": "Dyspnée, œdème des membres inférieurs, fatigue"
            },
            {
                "question": "Qu'est-ce qu'un électrocardiogramme (ECG)?",
                "answer": "Un examen qui enregistre l'activité électrique du cœur"
            }
        ],
        "quiz": [
            {
                "question": "Quelle valve sépare le ventricule gauche de l'aorte?",
                "options": {
                    "A": "Valve mitrale",
                    "B": "Valve aortique", 
                    "C": "Valve tricuspide",
                    "D": "Valve pulmonaire"
                },
                "correct": "B"
            },
            {
                "question": "Quelle est la pression artérielle normale au repos?",
                "options": {
                    "A": "140/90 mmHg",
                    "B": "120/80 mmHg",
                    "C": "100/60 mmHg", 
                    "D": "160/100 mmHg"
                },
                "correct": "B"
            }
        ],
        "sessions": 2
    }
    
    # Sample course 2: Neurologie
    course2 = {
        "nom": "Neurologie - Système Nerveux Central",
        "summary": """
        <h2>Le Système Nerveux Central</h2>
        <p>Étude approfondie du système nerveux central incluant:</p>
        <ul>
            <li>Anatomie du cerveau et de la moelle épinière</li>
            <li>Neurotransmetteurs et synapses</li>
            <li>Pathologies neurologiques</li>
            <li>Techniques d'imagerie médicale</li>
        </ul>
        """,
        "flashcards": [
            {
                "question": "Qu'est-ce que la substance grise?",
                "answer": "Tissu nerveux contenant principalement les corps cellulaires des neurones"
            },
            {
                "question": "Quel est le rôle de la dopamine?",
                "answer": "Neurotransmetteur impliqué dans le contrôle du mouvement et la motivation"
            },
            {
                "question": "Qu'est-ce que la maladie de Parkinson?",
                "answer": "Maladie neurodégénérative affectant le contrôle du mouvement"
            }
        ],
        "quiz": [
            {
                "question": "Combien de paires de nerfs crâniens existe-t-il?",
                "options": {
                    "A": "10",
                    "B": "12",
                    "C": "14",
                    "D": "16"
                },
                "correct": "B"
            }
        ],
        "sessions": 1
    }
    
    # Sample course 3: Pharmacologie
    course3 = {
        "nom": "Pharmacologie Générale",
        "summary": """
        <h2>Principes de Pharmacologie</h2>
        <p>Introduction aux concepts fondamentaux de pharmacologie:</p>
        <ul>
            <li>Pharmacocinétique (ADME)</li>
            <li>Pharmacodynamie</li>
            <li>Interactions médicamenteuses</li>
            <li>Effets indésirables</li>
        </ul>
        """,
        "flashcards": [
            {
                "question": "Que signifie ADME en pharmacocinétique?",
                "answer": "Absorption, Distribution, Métabolisme, Élimination"
            },
            {
                "question": "Qu'est-ce que la biodisponibilité?",
                "answer": "Fraction d'un médicament qui atteint la circulation systémique"
            }
        ],
        "quiz": [
            {
                "question": "Quel organe est principalement responsable du métabolisme des médicaments?",
                "options": {
                    "A": "Rein",
                    "B": "Foie",
                    "C": "Poumon",
                    "D": "Intestin"
                },
                "correct": "B"
            }
        ],
        "sessions": 0
    }
    
    try:
        # Save the sample courses
        save_course(sample_uid, "cardio-basics", course1)
        print("✓ Saved: Cardiologie - Les Bases")
        
        save_course(sample_uid, "neuro-snc", course2)
        print("✓ Saved: Neurologie - Système Nerveux Central")
        
        save_course(sample_uid, "pharmaco-general", course3)
        print("✓ Saved: Pharmacologie Générale")
        
        print(f"\n🎉 Sample data created successfully!")
        print(f"📋 Sample user UID: {sample_uid}")
        print(f"📚 3 courses have been added to the database")
        print(f"\nTo test with this data:")
        print(f"1. Use the UID '{sample_uid}' in your frontend requests")
        print(f"2. Or modify this script to use your actual Firebase UID")
        
        return True
        
    except Exception as e:
        print(f"❌ Error creating sample data: {e}")
        return False

if __name__ == "__main__":
    create_sample_courses()