import React from 'react';
import { render, screen } from '@testing-library/react';
import LandingPage from '../pages/LandingPage';

jest.mock('framer-motion', () => {
  return {
    motion: {
      section: ({ children, ...props }) => <section {...props}>{children}</section>,
      div: ({ children, ...props }) => <div {...props}>{children}</div>,
      button: ({ children, ...props }) => <button {...props}>{children}</button>,
    },
  };
});

jest.mock('../components/Hero', () => {
  return function MockHero() {
    return (
      <div data-testid="hero-component">
        <h1>Révolutionne tes révisions médicales</h1>
        <p>L'IA au service de ta réussite</p>
      </div>
    );
  };
});

jest.mock('lucide-react', () => {
  return {
    Brain: () => <div data-testid="brain-icon">Brain Icon</div>,
    BookOpen: () => <div data-testid="book-icon">BookOpen Icon</div>,
    Stethoscope: () => <div data-testid="stethoscope-icon">Stethoscope Icon</div>,
  };
});

jest.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }) => <div>{children}</div>,
}));

describe('LandingPage', () => {
  test('renders without crashing', () => {
    render(<LandingPage />);
    expect(screen.getByTestId('hero-component')).toBeInTheDocument();
  });

  test('displays main sections', () => {
    render(<LandingPage />);
    
    expect(screen.getByText('Pourquoi MedFlow ?')).toBeInTheDocument();
    expect(screen.getByText(/Une plateforme qui combine/)).toBeInTheDocument();
    expect(screen.getByText('Prêt à transformer ta façon d’apprendre ?')).toBeInTheDocument();
  });

  test('renders all feature cards', () => {
    render(<LandingPage />);
    
    expect(screen.getByText('IA intelligente')).toBeInTheDocument();
    expect(screen.getByText('Cas cliniques')).toBeInTheDocument();
    expect(screen.getByText('Flashcards dynamiques')).toBeInTheDocument();
  });

  test('renders feature descriptions', () => {
    render(<LandingPage />);
    
    expect(screen.getByText(/Planification et recommandations/)).toBeInTheDocument();
    expect(screen.getByText(/Mets en pratique tes connaissances/)).toBeInTheDocument();
    expect(screen.getByText(/Générées automatiquement/)).toBeInTheDocument();
  });

  test('renders call to action button', () => {
    render(<LandingPage />);
    
    const ctaButton = screen.getByText('Essayer gratuitement');
    expect(ctaButton).toBeInTheDocument();
    expect(ctaButton).toBeEnabled();
  });
});