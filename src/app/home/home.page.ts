import { Component } from '@angular/core';
import { Router } from '@angular/router';
// PDF.js CDN loader


@Component({
  selector: "app-home",
  templateUrl: "home.page.html",
  styleUrls: ["home.page.scss"],
})
export class HomePage {
  logoUrl = '../../../assets/logo.png';
  googleLogoUrl = '../../../assets/logobg.png';

  constructor(private router: Router) {}

  onClick(event: Event): void {
    event.preventDefault();
    this.router.navigate(['/dashboard']);
  }
}

