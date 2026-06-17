import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history.html',
  styleUrl: './history.css'
})
export class History implements OnInit {

  sales: any[] = [];

  expandedSaleId: number | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadSales();
  }

  loadSales() {

    const token = localStorage.getItem('token');

    this.http.get<any[]>(
      'https://bodega-backend-9c4f.onrender.com/sales',
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    ).subscribe({
      next: (res) => {
        this.sales = res;
      },

      error: (err) => {
        console.error(err);
      }
    });
  }

  toggleDetails(id: number) {

    this.expandedSaleId =
      this.expandedSaleId === id
        ? null
        : id;
  }
}