import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardPage } from './DashboardPage';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { server } from '../mocks/server';
import { http, HttpResponse, delay } from 'msw';

describe('DashboardPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    const renderDashboardPage = (userRole = 'user') => {
        // 模擬已登入狀態
        localStorage.setItem('auth_token', 'fake-token');
        server.use(
            http.get('/api/me', () => {
                return HttpResponse.json({ username: 'dean', role: userRole });
            })
        );

        return render(
            <MemoryRouter initialEntries={['/dashboard']}>
                <AuthProvider>
                    <Routes>
                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
                        <Route path="/admin" element={<div data-testid="admin-page">Admin Page</div>} />
                    </Routes>
                </AuthProvider>
            </MemoryRouter>
        );
    };

    describe('【前端元素】', () => {
        it('確認 DashboardPage 的基本資訊渲染', async () => {
            renderDashboardPage('user');
            expect(await screen.findByText('儀表板')).toBeDefined();
            expect(await screen.findByText(/Welcome, dean/i)).toBeDefined();
            expect(await screen.findByText('一般用戶')).toBeDefined();
        });

        it('驗證角色標籤的樣式類別 (CSS Class)', async () => {
            const { unmount } = renderDashboardPage('admin');
            const adminBadge = await screen.findByText('管理員');
            expect(adminBadge.className).toContain('role-badge');
            expect(adminBadge.className).toContain('admin');
            unmount();

            renderDashboardPage('user');
            const userBadge = await screen.findByText('一般用戶');
            expect(userBadge.className).toContain('role-badge');
            expect(userBadge.className).toContain('user');
        });
    });

    describe('【驗證權限】', () => {
        it('DashboardPage 應根據角色控制管理後台連結', async () => {
            // Case 1: admin 應能看到管理後台連結
            const { unmount } = renderDashboardPage('admin');
            expect(await screen.findByText('🛠️ 管理後台')).toBeDefined();
            unmount();

            // Case 2: user 不應看到管理後台連結
            renderDashboardPage('user');
            await waitFor(() => {
                expect(screen.queryByText('🛠️ 管理後台')).toBeNull();
            });
        });
    });

    describe('【Mock API】', () => {
        it('DashboardPage 成功載入商品列表', async () => {
            const mockProducts = [
                { id: 1, name: '測試商品 A', price: 100, description: '描述 A' }
            ];
            server.use(
                http.get('/api/products', () => {
                    return HttpResponse.json({ products: mockProducts });
                })
            );

            renderDashboardPage();

            expect(await screen.findByText('測試商品 A')).toBeDefined();
            expect(await screen.findByText('NT$ 100')).toBeDefined();
        });

        it('驗證金額格式化 (千分位)', async () => {
            const mockProducts = [
                { id: 1, name: '昂貴商品', price: 125000, description: '描述' }
            ];
            server.use(
                http.get('/api/products', () => {
                    return HttpResponse.json({ products: mockProducts });
                })
            );

            renderDashboardPage();
            expect(await screen.findByText('NT$ 125,000')).toBeDefined();
        });

        it('模擬 401 錯誤觸發自動登出', async () => {
            server.use(
                http.get('/api/products', () => {
                    return HttpResponse.json(
                        { message: 'Token Expired' },
                        { status: 401 }
                    );
                })
            );

            renderDashboardPage();

            await waitFor(() => {
                expect(screen.getByTestId('login-page')).toBeDefined();
            });
        });
    });

    describe('【UI 回饋】', () => {
        it('商品列表為空時的顯示 (Empty State)', async () => {
            server.use(
                http.get('/api/products', () => {
                    return HttpResponse.json({ products: [] });
                })
            );

            renderDashboardPage();
            expect(await screen.findByText('儀表板')).toBeDefined();
            expect(screen.getByText('商品列表')).toBeDefined();
            // 確認沒有商品卡片被渲染 (商品卡片中會有金額單位)
            expect(screen.queryByText(/NT\$/)).toBeNull();
        });
        it('DashboardPage 載入中狀態', async () => {
            server.use(
                http.get('/api/products', async () => {
                    await delay(500);
                    return HttpResponse.json({ products: [] });
                })
            );

            renderDashboardPage();
            expect(screen.getByText('載入商品中...')).toBeDefined();

            await waitFor(() => {
                expect(screen.queryByText('載入商品中...')).toBeNull();
            });
        });

        it('DashboardPage 載入失敗處理', async () => {
            server.use(
                http.get('/api/products', () => {
                    return HttpResponse.json(
                        { message: '伺服器大爆炸' },
                        { status: 500 }
                    );
                })
            );

            renderDashboardPage();
            expect(await screen.findByText('伺服器大爆炸')).toBeDefined();
        });
    });

    describe('【功能邏輯】', () => {
        it('驗證登出功能', async () => {
            renderDashboardPage();
            const logoutButton = await screen.findByRole('button', { name: '登出' });

            fireEvent.click(logoutButton);

            await waitFor(() => {
                expect(screen.getByTestId('login-page')).toBeDefined();
                expect(localStorage.getItem('auth_token')).toBeNull();
            });
        });
    });
});
