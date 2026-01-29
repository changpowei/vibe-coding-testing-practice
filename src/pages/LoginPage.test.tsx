import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginPage } from './LoginPage';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { server } from '../mocks/server';
import { http, HttpResponse, delay } from 'msw';

describe('LoginPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    const renderLoginPage = () => {
        return render(
            <MemoryRouter initialEntries={['/login']}>
                <AuthProvider>
                    <Routes>
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/dashboard" element={<div data-testid="dashboard">Dashboard</div>} />
                    </Routes>
                </AuthProvider>
            </MemoryRouter>
        );
    };

    describe('【前端元素】', () => {
        it('確認登入頁面基本欄位渲染', () => {
            renderLoginPage();
            expect(screen.getByText('歡迎回來')).toBeDefined();
            expect(screen.getByLabelText('電子郵件')).toBeDefined();
            expect(screen.getByLabelText('密碼')).toBeDefined();
            expect(screen.getByRole('button', { name: '登入' })).toBeDefined();
        });
    });

    describe('【function 邏輯】', () => {
        it('驗證無效的 Email 格式', async () => {
            renderLoginPage();
            const emailInput = screen.getByLabelText('電子郵件');
            const submitButton = screen.getByRole('button', { name: '登入' });

            fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
            fireEvent.click(submitButton);

            expect(await screen.findByText('請輸入有效的 Email 格式')).toBeDefined();
        });

        it('驗證密碼強度不足 (長度少於 8 位)', async () => {
            renderLoginPage();
            const emailInput = screen.getByLabelText('電子郵件');
            const passwordInput = screen.getByLabelText('密碼');
            const submitButton = screen.getByRole('button', { name: '登入' });

            fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
            fireEvent.change(passwordInput, { target: { value: 'abc1234' } });
            fireEvent.click(submitButton);

            expect(await screen.findByText('密碼必須至少 8 個字元')).toBeDefined();
        });

        it('驗證密碼強度不足 (未包含英數)', async () => {
            renderLoginPage();
            const emailInput = screen.getByLabelText('電子郵件');
            const passwordInput = screen.getByLabelText('密碼');
            const submitButton = screen.getByRole('button', { name: '登入' });

            fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

            // 只有數字
            fireEvent.change(passwordInput, { target: { value: '12345678' } });
            fireEvent.click(submitButton);
            expect(await screen.findByText('密碼必須包含英文字母和數字')).toBeDefined();

            // 只有字母
            fireEvent.change(passwordInput, { target: { value: 'abcdefgh' } });
            fireEvent.click(submitButton);
            expect(await screen.findByText('密碼必須包含英文字母和數字')).toBeDefined();
        });

        it('驗證電子郵件與密碼輸入自動修剪 (Trim)', async () => {
            // 注意：目前程式碼可能尚未實作 trim，此測試若失敗代表需補上功能
            renderLoginPage();
            const emailInput = screen.getByLabelText('電子郵件');
            const passwordInput = screen.getByLabelText('密碼');
            const submitButton = screen.getByRole('button', { name: '登入' });

            fireEvent.change(emailInput, { target: { value: ' user@example.com ' } });
            fireEvent.change(passwordInput, { target: { value: 'password123 ' } });

            // 點擊登入後，驗證是否通過格式檢查 (如果沒 trim，emailRegex 會失敗)
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.queryByText('請輸入有效的 Email 格式')).toBeNull();
            });
        });

        it('驗證欄位為空時的基礎阻攔', async () => {
            renderLoginPage();
            const submitButton = screen.getByRole('button', { name: '登入' });

            fireEvent.click(submitButton);

            expect(await screen.findByText('請輸入有效的 Email 格式')).toBeDefined();
            expect(await screen.findByText('密碼必須至少 8 個字元')).toBeDefined();
        });
    });

    describe('【Mock API】', () => {
        it('模擬登入成功並跳轉', async () => {
            renderLoginPage();
            const emailInput = screen.getByLabelText('電子郵件');
            const passwordInput = screen.getByLabelText('密碼');
            const submitButton = screen.getByRole('button', { name: '登入' });

            fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
            fireEvent.change(passwordInput, { target: { value: 'password123' } });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByTestId('dashboard')).toBeDefined();
            });
        });

        it('模擬登入失敗顯示伺服器錯誤', async () => {
            server.use(
                http.post('/api/login', () => {
                    return HttpResponse.json(
                        { message: '登入失敗，請稍後再試' },
                        { status: 401 }
                    );
                })
            );

            renderLoginPage();
            const emailInput = screen.getByLabelText('電子郵件');
            const passwordInput = screen.getByLabelText('密碼');
            const submitButton = screen.getByRole('button', { name: '登入' });

            fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
            fireEvent.change(passwordInput, { target: { value: 'password123' } });
            fireEvent.click(submitButton);

            expect(await screen.findByText('登入失敗，請稍後再試')).toBeDefined();
        });
    });

    describe('【UI 回饋】', () => {
        it('登入過程中按鈕與欄位狀態', async () => {
            server.use(
                http.post('/api/login', async () => {
                    await delay(500);
                    return HttpResponse.json({ accessToken: 'token', user: { username: 'dean', role: 'user' } });
                })
            );

            renderLoginPage();
            const emailInput = screen.getByLabelText('電子郵件');
            const passwordInput = screen.getByLabelText('密碼');
            const submitButton = screen.getByRole('button', { name: '登入' });

            fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
            fireEvent.change(passwordInput, { target: { value: 'password123' } });
            fireEvent.click(submitButton);

            // 檢查 Loading 狀態
            expect(screen.getByText('登入中...')).toBeDefined();
            expect(submitButton).toBeDisabled();
            expect(emailInput).toBeDisabled();
            expect(passwordInput).toBeDisabled();

            await waitFor(() => {
                expect(screen.queryByText('登入中...')).toBeNull();
            });
        });

        it('顯示登入過期提示訊息', async () => {
            renderLoginPage();

            // 模擬發送過期事件
            const message = '連線已逾時，請重新登入';
            const event = new CustomEvent('auth:unauthorized', { detail: message });
            window.dispatchEvent(event);

            expect(await screen.findByText(message)).toBeDefined();
        });
    });

    describe('【驗證權限】', () => {
        it('已登入狀態下造訪登入頁面應自動跳轉', async () => {
            // 模擬已登入狀態：LocalStorage 有 token 且 API 回傳使用者資料
            localStorage.setItem('auth_token', 'fake-token');
            server.use(
                http.get('/api/me', () => {
                    return HttpResponse.json({ username: 'dean', role: 'admin' });
                })
            );

            renderLoginPage();

            await waitFor(() => {
                expect(screen.getByTestId('dashboard')).toBeDefined();
            }, { timeout: 2000 });
        });
    });
});
