import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss']
})
export class LoginPage {
  logoUrl = '../../../assets/logo.png';
  googleLogoUrl = '../../../assets/logobg.png';

  constructor(private router: Router) {}

  onClick(event: Event): void {
    event.preventDefault();
    this.router.navigate(['/home']);
  }
}