import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HomePage } from './home.page';
import { AuthStore } from '../core/auth-store';
import { ProfileStore } from '../core/profile-store';

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: { signOut: vi.fn() } },
        {
          provide: ProfileStore,
          useValue: {
            displayName: signal('Ana'),
            profile: {
              error: signal(undefined),
              isLoading: signal(false),
              hasValue: signal(true),
              value: signal({ id: '1', name: 'Ana', email: 'ana@mail.com', avatar_url: null }),
            },
          },
        },
      ],
    });
    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('saluda con el nombre del perfil', () => {
    expect(fixture.nativeElement.textContent).toContain('Hola, Ana');
  });
});
