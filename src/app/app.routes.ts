import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { authGuard } from './auth.guard';
import { Register } from './pages/register/register';
import { ForgotPassword } from './pages/forgot-password/forgot-password';
import { MainLayout } from './layout/main-layout';


export const routes: Routes = [
    { path: '', redirectTo: 'login', pathMatch: 'full' },

    { path: 'login', component: Login },
    { path: 'register', component: Register },
    { path: 'forgot-password', component: ForgotPassword },

    {
        path: '',
        component: MainLayout,
        canActivate: [authGuard],
        children: [
            { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard) },
            { path: 'products', loadComponent: () => import('./pages/products/products').then(m => m.Products) },
            { path: 'settings', loadComponent: () => import('./pages/settings/settings').then(m => m.Settings) },
            { path: 'sales', loadComponent: () => import('./pages/sales/sales').then(m => m.Sales) },
            { path: 'prepared-products', loadComponent: () => import('./pages/prepared-products/prepared-products').then(m => m.PreparedProducts) },
            { path: 'sales-history', loadComponent: () => import('./pages/sales-history/sales-history').then(m => m.SalesHistoryComponent) },
            { path: 'tables', loadComponent: () => import('./pages/tables/tables').then(m => m.Tables) },
            { path: 'reports', loadComponent: () => import('./pages/reports/reports').then(m => m.Reports) },

        ]
    },
    { path: '**', redirectTo: 'login' }
];
