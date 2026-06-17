import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-sales-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sales-history.html',
  styleUrl: './sales-history.css'
})
export class SalesHistoryComponent implements OnInit {
  sales: any[] = [];
  selectedSale: any = null;
  
  constructor(private http: HttpClient, private cd: ChangeDetectorRef) {}

  ngOnInit(): void {
      this.loadSales();
  }

  loadSales(){
    const token = localStorage.getItem('token');
    console.log('TOKEN:', token);
    this.http.get<any[]>('https://bodega-backend-9c4f.onrender.com/sales', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }).subscribe({
      next: (res) => {
        console.log('Ventas cargadas:', res);
        this.sales = res.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        this.cd.detectChanges();
      },
      error: (error) => {
        console.error('Error cargando ventas:', error);
      }
    });
  }

  translatePayment(method: string) {

    switch(method){

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

  openDetails(sale: any){
    this.selectedSale = sale;
  }
}
