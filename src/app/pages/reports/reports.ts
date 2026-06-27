import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.html',
  styleUrl: './reports.css'
})
export class Reports implements OnInit {

  report: any = null;

  dailyCash: any = null;
  dailyCashHistory: any[] = [];
  dailyCashExpenses: any[] = [];
  openingAmount: number | null = null;
  expenseDescription = '';
  expenseAmount: number | null = null;
  closingAmount: number | null = null;

  lastClosedCash: any = null;
  selectedDailyCash: any = null;
  selectedDailyCashExpenses: any[] = [];

  activeTab: 'sales' | 'products' | 'cash'= 'sales';
  cashClosures: any[] = [];

  fromDate = '';
  fromTime = '00:00';

  toDate = '';
  toTime = '23:59';

  loadingReport = false;

  selectedSale: any = null;

  selectedClosure: any = null;

  constructor(private http: HttpClient, private cdRef: ChangeDetectorRef) {}

  ngOnInit() {
    const today = new Date();
    const lastWeek = new Date();

    lastWeek.setDate(today.getDate() - 7);

    this.fromDate = this.formatDate(lastWeek);
    this.toDate = this.formatDate(today);

    this.loadReport();
    this.loadCashClosures()
    this.loadDailyCash();
    this.loadDailyCashHistory();
    this.loadLastClosedCash();
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, '0');

    const day = String(
      date.getDate()
    ).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  loadReport() {
    const token = localStorage.getItem('token');
    const from = `${this.fromDate}T${this.fromTime}`;
    const to = `${this.toDate}T${this.toTime}`;

    this.loadingReport = true;
    this.cdRef.detectChanges();

    this.http.get<any>(
      `https://bodega-backend-9c4f.onrender.com/sales/report?from=${from}&to=${to}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    ).subscribe({
      next: (res) => {
        this.report = res;
        this.loadingReport = false;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.loadingReport = false;
        this.cdRef.detectChanges();
      }
    });
  }

  openSale(sale: any) {
    this.selectedSale = sale;
  }

  closeSale() {
    this.selectedSale = null;
  }

  getSoldProducts() {
    if (!this.report?.sales) {
      return [];
    }

    const productsMap = new Map<string, any>();

    this.report.sales.forEach((sale: any) => {
      sale.items?.forEach((item: any) => {
        const key = item.productName;

        if (!productsMap.has(key)) {
          productsMap.set(key, {
            productName: item.productName,
            quantity: 0,
            total: 0
          });
        }

        const product = productsMap.get(key);

        product.quantity += item.quantity;
        product.total += item.quantity * item.price;
      });
    });

    return Array.from(productsMap.values())
      .sort((a, b) => b.quantity - a.quantity);
  }

  getPaymentMethodLabel(method: string): string {
    switch(method) {
      case 'CASH':
        return 'Efectivo';

      case 'TRANSFER':
        return 'Transferencia';

      case 'DEBIT':
        return 'Débito';

      case 'CREDIT':
        return 'Crédito';

      default:
        return method;
    }
  }

  getBestSalesDay() {
    if (!this.report?.sales?.length) return null;

    const days = new Map<string, number>();

    this.report.sales.forEach((sale: any) => {
      const day = new Date(sale.createdAt).toLocaleDateString('es-AR');

      days.set(
        day,
        (days.get(day) || 0) + sale.total
      );
    });

    return Array.from(days.entries())
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => b.total - a.total)[0];
  }

  getBiggestSale() {
    if (!this.report?.sales?.length) return null;

    return [...this.report.sales]
      .sort((a, b) => b.total - a.total)[0];
  }

  loadCashClosures() {
    const token = localStorage.getItem('token');

    this.http.get<any[]>(
      'https://bodega-backend-9c4f.onrender.com/cash-closures',
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    ).subscribe(res => {
      this.cashClosures = res;
      this.cdRef.detectChanges();
    });
  }

  closeCash() {
    if (!this.report) {
      return;
    }

    const confirmed = confirm(
      '¿Cerrar caja para este período?'
    );

    if (!confirmed) {
      return;
    }

    const token = localStorage.getItem('token');

    const from =
      `${this.fromDate}T${this.fromTime}`;

    const to =
      `${this.toDate}T${this.toTime}`;

    this.http.post<any>(
      `https://bodega-backend-9c4f.onrender.com/cash-closures?from=${from}&to=${to}`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    ).subscribe(() => {
      this.loadCashClosures();
      alert('Caja cerrada correctamente');
      this.cdRef.detectChanges();
    });
  }

  openClosure(closure: any) {
    this.selectedClosure = closure;
  }

  closeClosure() {
    this.selectedClosure = null;
  }

  printClosure() {
    window.print();
  }

  loadDailyCash() {
    const token = localStorage.getItem('token');

    this.http.get<any>(
      'https://bodega-backend-9c4f.onrender.com/daily-cash/current',
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    ).subscribe(res => {
      this.dailyCash = res;

      if (res) {
        this.loadDailyCashExpenses();
      }

      this.cdRef.detectChanges();
    });
  }

  openDailyCash() {
    if (this.openingAmount === null) return;

    const token = localStorage.getItem('token');

    this.http.post<any>(
      'https://bodega-backend-9c4f.onrender.com/daily-cash/open',
      {
        openingAmount: this.openingAmount
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    ).subscribe(() => {
      this.openingAmount = null;
      this.loadDailyCash();
      this.loadDailyCashHistory();
      this.loadLastClosedCash();

      this.cdRef.detectChanges();
    });
  }

  loadDailyCashExpenses() {
    const token = localStorage.getItem('token');

    this.http.get<any[]>(
      'https://bodega-backend-9c4f.onrender.com/daily-cash/expenses',
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    ).subscribe(res => {
      this.dailyCashExpenses = res;
      this.cdRef.detectChanges();
    });
  }

  addDailyExpense() {
    if (!this.expenseDescription.trim()) return;
    if (this.expenseAmount === null) return;

    const token = localStorage.getItem('token');

    this.http.post<any>(
      'https://bodega-backend-9c4f.onrender.com/daily-cash/expenses',
      {
        description: this.expenseDescription,
        amount: this.expenseAmount
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    ).subscribe(() => {
      this.expenseDescription = '';
      this.expenseAmount = null;
      this.loadDailyCashExpenses();

      this.cdRef.detectChanges();
    });
  }

  closeDailyCash() {
    if (this.closingAmount === null) return;

    const confirmed = confirm('¿Cerrar la caja diaria?');

    if (!confirmed) return;

    const token = localStorage.getItem('token');

    this.http.post<any>(
      'https://bodega-backend-9c4f.onrender.com/daily-cash/close',
      {
        closingAmount: this.closingAmount
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    ).subscribe(() => {
      this.closingAmount = null;
      this.dailyCash = null;
      this.dailyCashExpenses = [];

      this.loadDailyCash();
      this.loadDailyCashHistory();

      this.cdRef.detectChanges();
    });
  }

  loadDailyCashHistory() {
    const token = localStorage.getItem('token');

    this.http.get<any[]>(
      'https://bodega-backend-9c4f.onrender.com/daily-cash/history',
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    ).subscribe(res => {
      this.dailyCashHistory = res;
      this.cdRef.detectChanges();
    });
  }

  getDailyCashSales() {
    if (!this.dailyCash?.openedAt || !this.report?.sales) {
      return 0;
    }

    const openedAt = new Date(this.dailyCash.openedAt);
    const now = new Date();

    return this.report.sales
      .filter((sale: any) => {
        const saleDate = new Date(sale.createdAt);

        return saleDate >= openedAt && saleDate <= now;
      })
      .reduce((acc: number, sale: any) => {

        const cashAmount = sale.payments
          ?.filter((p: any) => p.method === 'CASH')
          .reduce(
            (sum: number, p: any) => sum + Number(p.amount),
            0
          ) || 0;

        return acc + cashAmount;
      }, 0);
  }

  getDailyTheoreticalCash() {
    if (!this.dailyCash) {
      return 0;
    }

    return Number(this.dailyCash.openingAmount)
      + this.getDailyCashSales()
      - this.getExpensesTotal();
  }

  getDailyWithdrawPreview() {
    if (this.closingAmount === null) {
      return 0;
    }

    return this.getDailyTheoreticalCash()
      - Number(this.closingAmount);
  }

  loadLastClosedCash() {
    const token = localStorage.getItem('token');

    this.http.get<any>(
      'https://bodega-backend-9c4f.onrender.com/daily-cash/last-closed',
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    ).subscribe(res => {
      this.lastClosedCash = res;

      if (!this.dailyCash && res?.closingAmount) {
        this.openingAmount = res.closingAmount;
      }

      this.cdRef.detectChanges();
    });
  }

  useLastClosingAmount() {
    if (!this.lastClosedCash) return;

    this.openingAmount =
      this.lastClosedCash.closingAmount;
  }

  deleteDailyExpense(expenseId: number) {
    if (!confirm('¿Eliminar este gasto?')) return;

    const token = localStorage.getItem('token');

    this.http.delete(
      `https://bodega-backend-9c4f.onrender.com/daily-cash/expenses/${expenseId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    ).subscribe(() => {
      this.loadDailyCashExpenses();
      this.cdRef.detectChanges();
    });
  }

  openDailyCashDetail(cash: any) {
    this.selectedDailyCash = cash;

    const token = localStorage.getItem('token');

    this.http.get<any[]>(
      `https://bodega-backend-9c4f.onrender.com/daily-cash/${cash.id}/expenses`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    ).subscribe(res => {
      this.selectedDailyCashExpenses = res;
      this.cdRef.detectChanges();
    });
  }

  closeDailyCashDetail() {
    this.selectedDailyCash = null;
    this.selectedDailyCashExpenses = [];
  }

  getExpensesTotal() {
    return this.dailyCashExpenses.reduce(
      (acc, e) => acc + Number(e.amount),
      0
    );
  }

  getReportSubtotal() {
    if (!this.report?.sales) {
      return 0;
    }

    return this.report.sales.reduce(
      (acc: number, sale: any) => acc + Number(sale.subtotal ?? sale.total ?? 0),
      0
    );
  }

  getReportDiscount() {
    if (!this.report?.sales) {
      return 0;
    }

    return this.report.sales.reduce(
      (acc: number, sale: any) => acc + Number(sale.discount ?? 0),
      0
    );
  }
}