import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class ProductsService {

  private apiUrl = 'https://bodega-backend-9c4f.onrender.com';
  private cache: any[] | null = null;

  constructor(private http: HttpClient) {}

  getHeaders() {
    return {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    };
  }

  getProducts(search: string = '', categoryId: number | null = null, forceRefresh = false): Observable<any[]> {
    let url = `${this.apiUrl}/products`;
    const params: string[] = [];

    if (search) params.push(`search=${encodeURIComponent(search)}`);
    if (categoryId) params.push(`categoryId=${categoryId}`);
    if (params.length) url += '?' + params.join('&');

    const useCache = !search && !categoryId && !forceRefresh && this.cache;

    if (useCache) {
      return new Observable(obs => {
        obs.next(this.cache!);
        obs.complete();
      });
    }

    return this.http.get<any[]>(url, { headers: this.getHeaders() }).pipe(
      tap(res => {
        if (!search && !categoryId) {
          this.cache = res;
        }
      })
    );
  }

  invalidateCache() {
    this.cache = null;
  }
}