import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminPage } from './AdminPage';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';

describe('AdminPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    const renderAdminPage = () => {
        localStorage.setItem('auth_token', 'admin-token');
        server.use(
            http.get('/api/me', () => {
                return HttpResponse.json({ username: 'admin_user', role: 'admin' });
            })
        );

        return render(
            <MemoryRouter initialEntries={['/admin']}>
                <AuthProvider>
                    <Routes>
                        <Route path="/admin" element={<AdminPage />} />
                        <Route path="/dashboard" element={<div data-testid="dashboard">Dashboard</div>} />
                    </Routes>
                </AuthProvider>
            </MemoryRouter>
        );
    };

    describe('【前端元素】', () => {
        it('確認 AdminPage 的渲染內容', async () => {
            renderAdminPage();
            expect(await screen.findByText('🛠️ 管理後台')).toBeDefined();
            expect(await screen.findByText('管理員專屬頁面')).toBeDefined();
            expect(await screen.findByText('管理員')).toBeDefined();
        });
    });

    describe('【驗證權限】', () => {
        it('AdminPage 的返回連結', async () => {
            renderAdminPage();
            const backLink = await screen.findByText('← 返回');

            fireEvent.click(backLink);

            await waitFor(() => {
                expect(screen.getByTestId('dashboard')).toBeDefined();
            });
        });
    });
});
