import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../App';

jest.mock('../pages/LandingPage', () => {
  return function MockLandingPage() {
    return <div>LandingPage</div>;
  };
});

jest.mock('../pages/Login', () => {
  return function MockLogin() {
    return <div>Login</div>;
  };
});

jest.mock('../pages/Register', () => {
  return function MockRegister() {
    return <div>Register</div>;
  };
});

jest.mock('../pages/Dashboard', () => {
  return function MockDashboard() {
    return <div>Dashboard</div>;
  };
});

jest.mock('../pages/UserSettings', () => {
  return function MockUserSettings() {
    return <div>UserSettings</div>;
  };
});

jest.mock('../pages/UploadCours', () => {
  return function MockUploadCours() {
    return <div>UploadCours</div>;
  };
});

jest.mock('../pages/RevisionPage', () => {
  return function MockRevisionPage() {
    return <div>RevisionPage</div>;
  };
});

jest.mock('../pages/Pricing', () => {
  return function MockPricing() {
    return <div>Pricing</div>;
  };
});

jest.mock('../components/Navbar', () => {
  return function MockNavbar() {
    return <nav>Navbar</nav>;
  };
});

jest.mock('../components/Footer', () => {
  return function MockFooter() {
    return <footer>Footer</footer>;
  };
});

jest.mock('../components/ScrollToTop', () => {
  return function MockScrollToTop() {
    return <div>ScrollToTop</div>;
  };
});

jest.mock('../components/ProtectedRoute', () => {
  return function MockProtectedRoute({ children }) {
    return <div>ProtectedRoute: {children}</div>;
  };
});

jest.mock('../components/PublicRoute', () => {
  return function MockPublicRoute({ children }) {
    return <div>PublicRoute: {children}</div>;
  };
});

jest.mock('../components/theme-provider', () => {
  return {
    ThemeProvider: function MockThemeProvider({ children, attribute, defaultTheme, enableSystem }) {
      return (
        <div data-testid="theme-provider" data-attribute={attribute} data-default-theme={defaultTheme}>
          {children}
        </div>
      );
    }
  };
});

jest.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }) => <div data-testid="browser-router">{children}</div>,
  Routes: ({ children }) => <div data-testid="routes">{children}</div>,
  Route: ({ path, element }) => <div data-testid={`route-${path}`}>{element}</div>,
}));

describe('App Component', () => {
  test('renders without crashing', () => {
    render(<App />);
    expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
  });

  test('renders main layout structure', () => {
    render(<App />);
    expect(screen.getByText('Navbar')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });

  test('theme provider has correct props', () => {
    render(<App />);
    const themeProvider = screen.getByTestId('theme-provider');
    expect(themeProvider).toHaveAttribute('data-attribute', 'class');
    expect(themeProvider).toHaveAttribute('data-default-theme', 'system');
  });
});