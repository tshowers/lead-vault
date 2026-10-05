import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ToastComponent } from './shared/toast/toast.component';
import { AppHeaderComponent } from './shared/app-header/app-header.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent, AppHeaderComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'lead-vault';
}
