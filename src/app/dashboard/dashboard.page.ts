import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
})
export class DashboardPage implements OnInit {

  // Stats data
  stats = {
    totalAmount: 2450,
    totalInvoices: 47,
    pendingInvoices: 12,
    thisMonth: 8750,
    btwEnabled: true
  };

  // Recent invoices data
  recentInvoices = [
    { id: 1, supplier: 'Leverancier A', amount: 450, date: '2024-08-04', status: 'processed' },
    { id: 2, supplier: 'Leverancier B', amount: 280, date: '2024-08-03', status: 'pending' },
    { id: 3, supplier: 'Leverancier C', amount: 680, date: '2024-08-02', status: 'processed' },
    { id: 4, supplier: 'Leverancier D', amount: 120, date: '2024-08-01', status: 'pending' }
  ];

  // Filter tabs
  activeTab = 'vandaag';
  tabs = ['vandaag', 'gisteren', 'deze week'];

  // UI state
  showUploadModal = false;
  isLoading = false;

  constructor(private router: Router) { }

  ngOnInit(): void {
    this.loadDashboardData();
  }
  openFilePicker() {
    const input = document.getElementById('file-input') as HTMLInputElement;
    if (input) {
      input.click();
    }
  }

  // Navigation methods
  navigateToUpload(): void {
    this.router.navigate(['/upload']);
  }

  navigateToInvoices(): void {
    this.router.navigate(['/invoices']);
  }

  navigateToSettings(): void {
    this.router.navigate(['/settings']);
  }

  // Tab switching
  switchTab(tab: string): void {
    this.activeTab = tab;
    this.loadDashboardData();
  }

  // Modal controls
  openUploadModal(): void {
    this.showUploadModal = true;
  }

  closeUploadModal(): void {
    this.showUploadModal = false;
  }

  // File upload handling
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.uploadFile(file);
    }
  }

  uploadFile(file: File): void {
    this.isLoading = true;
    // Simulate upload process
    setTimeout(() => {
      this.isLoading = false;
      this.showUploadModal = false;
      this.showSuccessMessage('Factuur succesvol geüpload!');
      this.loadDashboardData();
    }, 2000);
  }

  // Data loading
  loadDashboardData(): void {
    // Simulate API call based on active tab
    this.isLoading = true;
    setTimeout(() => {
      // Update data based on selected tab
      this.isLoading = false;
    }, 500);
  }

  // Utility methods
  showSuccessMessage(message: string): void {
    // Implement toast notification
    console.log(message);
  }

  getStatusColor(status: string): string {
    return status === 'processed' ? 'text-green-600' : 'text-orange-600';
  }

  getStatusText(status: string): string {
    return status === 'processed' ? 'Verwerkt' : 'In behandeling';
  }

  // Quick actions
  exportData(): void {
    // Implement export functionality
    console.log('Exporting data...');
  }

  viewReports(): void {
    this.router.navigate(['/reports']);
  }
}

