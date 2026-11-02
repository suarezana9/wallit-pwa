import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { AuthStore } from './core/auth-store';
import { ProfileStore } from './core/profile-store';
import { PushService } from './notifications/push.service';

describe('AppComponent', () => {
  it('should create the app', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: { isLoggedIn: signal(false), user: signal(null) } },
        { provide: ProfileStore, useValue: { displayName: signal('') } },
        { provide: PushService, useValue: {} },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
