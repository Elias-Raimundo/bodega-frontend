import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CompanyService {

  private companySubject = new BehaviorSubject<any>(
    JSON.parse(localStorage.getItem('company') || 'null')
  );

  company$ = this.companySubject.asObservable();

  setCompany(data: any) {

    localStorage.setItem('company', JSON.stringify(data));

    this.companySubject.next(data);

    document.documentElement.style.setProperty(
      '--primary-color',
      data.primaryColor || '#3b82f6'
    );

    if (data.darkMode) {
      document.body.classList.add('dark');
    }else{
      document.body.classList.remove('dark');
    }
  }

  getCompany() {
    return this.companySubject.value;
  }
}