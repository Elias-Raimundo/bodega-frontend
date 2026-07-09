import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class PreparedProductsService {

  private apiUrl = 'https://bodega-backend-9c4f.onrender.com';
  private cache: any[] | null = null;

  constructor(private http: HttpClient) {}

  getHeaders() {
    return {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    };
  }

  getPreparedProducts(forceRefresh = false): Observable<any[]> {
    if (!forceRefresh && this.cache) {
      return new Observable(obs => {
        obs.next(this.cache!);
        obs.complete();
      });
    }

    return this.http.get<any[]>(
      `${this.apiUrl}/prepared-products`,
      { headers: this.getHeaders() }
    ).pipe(
      tap(res => { this.cache = res; })
    );
  }

  invalidateCache() {
    this.cache = null;
  }
}