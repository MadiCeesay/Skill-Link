import { afterEach, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../src/api/auth';
import { session } from '../src/api/client';
import { AuthPage } from '../src/features/auth';
afterEach(() => session.clear());
it.each(['customer', 'worker'])('allows eight characters on the %s registration form', (role) => {
  session.clear();
  render(<QueryClientProvider client={new QueryClient()}><AuthProvider><MemoryRouter initialEntries={['/register/' + role]}><Routes><Route path="/register/:kind" element={<AuthPage />} /></Routes></MemoryRouter></AuthProvider></QueryClientProvider>);
  const input = screen.getByLabelText('Password');
  expect(input).toHaveAttribute('minlength', '8');
  expect(screen.getByText('At least 8 characters, including uppercase, lowercase and a number.')).toBeInTheDocument();
  for (const value of ['Abc1234', 'abcd1234', 'ABCD1234', 'Abcdefgh']) {
    fireEvent.change(input, { target: { value } });
    expect(input.checkValidity()).toBe(false);
  }
  fireEvent.change(input, { target: { value: 'Abcd1234' } });
  expect(input.checkValidity()).toBe(true);
});
