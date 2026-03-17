import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Login from './Login';
import { STORAGE_KEYS, ROUTES } from '../constants';

const loginAPIMock = vi.fn();

vi.mock('../services/auth', () => ({
  loginAPI: (...args) => loginAPIMock(...args),
}));

const renderLoginFlow = () => {
  render(
    <MemoryRouter initialEntries={[`/${ROUTES.LOGIN}`]}>
      <Routes>
        <Route path={`/${ROUTES.LOGIN}`} element={<Login />} />
        <Route path={`/${ROUTES.REGISTER}`} element={<div>Register Page</div>} />
        <Route path={`/${ROUTES.DASHBOARD}`} element={<div>Dashboard Page</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('Login integration', () => {
  it('completes backend login and redirects to dashboard', async () => {
    loginAPIMock.mockResolvedValue({
      user: {
        id: 1,
        email: 'admin@clinic.com',
        name: 'Admin User',
        role: 'admin',
      },
      token: 'jwt-token',
      refreshToken: 'refresh-token',
    });

    renderLoginFlow();

    fireEvent.change(screen.getByPlaceholderText('Username'), {
      target: { value: 'admin@clinic.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: '123456' },
    });

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Dashboard Page')).toBeTruthy();
    });

    const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
    expect(storedUser).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEYS.TOKEN)).toBe('jwt-token');
    expect(localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)).toBe('refresh-token');
  });

  it('navigates to register page when clicking Sign up', async () => {
    renderLoginFlow();

    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(screen.getByText('Register Page')).toBeTruthy();
    });
  });

  it('shows backend error on invalid login', async () => {
    loginAPIMock.mockRejectedValue({ message: 'Invalid credentials' });

    renderLoginFlow();

    fireEvent.change(screen.getByPlaceholderText('Username'), {
      target: { value: 'admin@clinic.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'wrong-password' },
    });

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeTruthy();
    });
  });
});
