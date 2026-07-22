import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChangeDetectorRef } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

const API_URL = 'https://bodega-backend-9c4f.onrender.com';
// TODO: mover a environment.ts, mismo comentario que en los demás componentes

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

  // NUEVO: flags de carga para evitar doble submit en acciones de caja
  closingCash = false;
  openingDailyCash = false;
  addingExpense = false;
  closingDailyCash = false;
  deletingExpenseId: number | null = null;

  constructor(
    private http: HttpClient,
    private cdRef: ChangeDetectorRef,
    private toastr: ToastrService
  ) {}

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

  getHeaders() {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  }

  // Mismo helper que en el resto de los componentes
  private getErrorMessage(err: HttpErrorResponse, fallback: string): string {
    if (err.status === 0) {
      return 'No se pudo conectar con el servidor. Revisá tu conexión a internet.';
    }
    if (typeof err.error === 'string' && err.error.trim()) {
      return err.error;
    }
    if (err.error?.message) {
      return Array.isArray(err.error.message)
        ? err.error.message.join(', ')
        : err.error.message;
    }
    if (err.status === 401) {
      return 'Tu sesión expiró. Iniciá sesión de nuevo.';
    }
    return fallback;
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
    const from = `${this.fromDate}T${this.fromTime}`;
    const to = `${this.toDate}T${this.toTime}`;

    this.loadingReport = true;
    this.cdRef.detectChanges();

    this.http.get<any>(
      `${API_URL}/sales/report?from=${from}&to=${to}`,
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.report = res;
        this.loadingReport = false;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.toastr.error(this.getErrorMessage(err, 'No se pudo cargar el reporte'));
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
    this.http.get<any[]>(
      `${API_URL}/cash-closures`,
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.cashClosures = res;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando cierres de caja:', err);
        this.toastr.error(this.getErrorMessage(err, 'No se pudieron cargar los cierres de caja'));
      }
    });
  }

  closeCash() {
    if (!this.report) {
      this.toastr.warning('Esperá a que cargue el reporte antes de cerrar la caja');
      return;
    }

    const confirmed = confirm(
      '¿Cerrar caja para este período?'
    );

    if (!confirmed) {
      return;
    }

    if (this.closingCash) return;
    this.closingCash = true;

    const from = `${this.fromDate}T${this.fromTime}`;
    const to = `${this.toDate}T${this.toTime}`;

    this.http.post<any>(
      `${API_URL}/cash-closures?from=${from}&to=${to}`,
      {},
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        this.closingCash = false;
        this.loadCashClosures();
        this.toastr.success('Caja cerrada correctamente');
        this.cdRef.detectChanges();
      },
      error: (err) => {
        // ANTES: no había NINGÚN manejo de error acá. Si el backend
        // rechazaba el cierre (período ya cerrado, fechas inválidas,
        // sesión vencida, etc.) no pasaba nada en absoluto.
        console.error('Error cerrando caja:', err);
        this.closingCash = false;
        this.toastr.error(this.getErrorMessage(err, 'No se pudo cerrar la caja'));
        this.cdRef.detectChanges();
      }
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
    this.http.get<any>(
      `${API_URL}/daily-cash/current`,
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.dailyCash = res;

        if (res) {
          this.loadDailyCashExpenses();
        }

        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando caja diaria:', err);
        this.toastr.error(this.getErrorMessage(err, 'No se pudo cargar la caja diaria'));
      }
    });
  }

  openDailyCash() {
    if (this.openingAmount === null) {
      this.toastr.warning('Ingresá el monto de apertura');
      return;
    }

    if (this.openingDailyCash) return;
    this.openingDailyCash = true;

    this.http.post<any>(
      `${API_URL}/daily-cash/open`,
      { openingAmount: this.openingAmount },
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        this.openingDailyCash = false;
        this.toastr.success('Caja abierta correctamente');
        this.openingAmount = null;
        this.loadDailyCash();
        this.loadDailyCashHistory();
        this.loadLastClosedCash();

        this.cdRef.detectChanges();
      },
      error: (err) => {
        // ANTES: sin manejo de error. Si ya había una caja abierta, o
        // fallaba la validación, el botón "Abrir caja" no hacía nada.
        console.error('Error abriendo caja diaria:', err);
        this.openingDailyCash = false;
        this.toastr.error(this.getErrorMessage(err, 'No se pudo abrir la caja'));
        this.cdRef.detectChanges();
      }
    });
  }

  loadDailyCashExpenses() {
    this.http.get<any[]>(
      `${API_URL}/daily-cash/expenses`,
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.dailyCashExpenses = res;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando gastos:', err);
        this.toastr.error(this.getErrorMessage(err, 'No se pudieron cargar los gastos'));
      }
    });
  }

  addDailyExpense() {
    if (!this.expenseDescription.trim()) {
      this.toastr.warning('Ingresá una descripción del gasto');
      return;
    }
    if (this.expenseAmount === null || this.expenseAmount <= 0) {
      this.toastr.warning('Ingresá un monto válido');
      return;
    }

    if (this.addingExpense) return;
    this.addingExpense = true;

    this.http.post<any>(
      `${API_URL}/daily-cash/expenses`,
      {
        description: this.expenseDescription,
        amount: this.expenseAmount
      },
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        this.addingExpense = false;
        this.toastr.success('Gasto registrado');
        this.expenseDescription = '';
        this.expenseAmount = null;
        this.loadDailyCashExpenses();

        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error agregando gasto:', err);
        this.addingExpense = false;
        this.toastr.error(this.getErrorMessage(err, 'No se pudo registrar el gasto'));
        this.cdRef.detectChanges();
      }
    });
  }

  closeDailyCash() {
    if (this.closingAmount === null) {
      this.toastr.warning('Ingresá el monto de cierre');
      return;
    }

    const confirmed = confirm('¿Cerrar la caja diaria?');

    if (!confirmed) return;

    if (this.closingDailyCash) return;
    this.closingDailyCash = true;

    this.http.post<any>(
      `${API_URL}/daily-cash/close`,
      { closingAmount: this.closingAmount },
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        // ANTES: sin manejo de error. Este es probablemente el punto
        // exacto donde "cerrar caja" fallaba en silencio.
        this.closingDailyCash = false;
        this.toastr.success('Caja diaria cerrada correctamente');
        this.closingAmount = null;
        this.dailyCash = null;
        this.dailyCashExpenses = [];

        this.loadDailyCash();
        this.loadDailyCashHistory();

        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error cerrando caja diaria:', err);
        this.closingDailyCash = false;
        this.toastr.error(this.getErrorMessage(err, 'No se pudo cerrar la caja diaria'));
        this.cdRef.detectChanges();
      }
    });
  }

  loadDailyCashHistory() {
    this.http.get<any[]>(
      `${API_URL}/daily-cash/history`,
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.dailyCashHistory = res;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando historial de caja:', err);
        this.toastr.error(this.getErrorMessage(err, 'No se pudo cargar el historial de caja'));
      }
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
    this.http.get<any>(
      `${API_URL}/daily-cash/last-closed`,
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.lastClosedCash = res;

        if (!this.dailyCash && res?.closingAmount) {
          this.openingAmount = res.closingAmount;
        }

        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando último cierre:', err);
        this.toastr.error(this.getErrorMessage(err, 'No se pudo cargar el último cierre de caja'));
      }
    });
  }

  useLastClosingAmount() {
    if (!this.lastClosedCash) return;

    this.openingAmount =
      this.lastClosedCash.closingAmount;
  }

  deleteDailyExpense(expenseId: number) {
    if (!confirm('¿Eliminar este gasto?')) return;

    if (this.deletingExpenseId === expenseId) return;
    this.deletingExpenseId = expenseId;

    this.http.delete(
      `${API_URL}/daily-cash/expenses/${expenseId}`,
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        this.deletingExpenseId = null;
        this.toastr.success('Gasto eliminado');
        this.loadDailyCashExpenses();
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error eliminando gasto:', err);
        this.deletingExpenseId = null;
        this.toastr.error(this.getErrorMessage(err, 'No se pudo eliminar el gasto'));
        this.cdRef.detectChanges();
      }
    });
  }

  openDailyCashDetail(cash: any) {
    this.selectedDailyCash = cash;

    this.http.get<any[]>(
      `${API_URL}/daily-cash/${cash.id}/expenses`,
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.selectedDailyCashExpenses = res;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando gastos del detalle:', err);
        this.toastr.error(this.getErrorMessage(err, 'No se pudieron cargar los gastos de esta caja'));
      }
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