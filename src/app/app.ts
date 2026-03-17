import { ChangeDetectionStrategy, Component, signal, inject, DestroyRef, OnInit, PLATFORM_ID, afterNextRender } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { animate, stagger } from "motion";
import { ActivatedRoute } from '@angular/router';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import guestsData from './guests.json';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);
  private route = inject(ActivatedRoute);

  weddingDate = new Date('2026-04-25T15:00:00');
  timeLeft = signal({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  rsvpForm: FormGroup;
  rsvpSubmitted = signal(false);
  
  // Personalized Guest Data
  guestName = signal<string | null>(null);
  guestPasses = signal<number>(2);
  inviteId = signal<string | null>(null);

  // UI State
  isOpened = signal(false);
  envelopeClosing = signal(false);
  showCalendarModal = signal(false);
  randomStory = signal('');

  storyPhrases = [
    "Desde aquel primer café, supimos que este viaje apenas comenzaba.",
    "Dos almas que se encontraron en el momento perfecto para caminar juntas siempre.",
    "Nuestra historia no es perfecta, pero es nuestra y es la más hermosa que conocemos.",
    "Cada paso que hemos dado nos ha traído hasta aquí, al inicio de nuestro 'para siempre'.",
    "El amor no se busca, se construye día a día, y nosotros hemos construido un palacio.",
    "Eres mi aventura favorita y el hogar al que siempre quiero volver.",
    "Lo mejor de mi vida es estar en la tuya. Hoy celebramos ese privilegio.",
    "Unidos por el destino, elegidos por el corazón. Nuestra historia continúa hoy.",
    "No hay nada más valioso que el tiempo que pasamos juntos, y hoy decidimos que sea eterno.",
    "Contigo, cada día es una celebración. Gracias por ser mi compañero de vida."
  ];

  itinerary = [
    { time: '15:30', title: 'Ceremonia Civil', icon: 'history_edu' },
    { time: '16:00', title: 'Coctel & Fotos', icon: 'photo_camera' },
    { time: '16:30', title: 'Baile de Esposos', icon: 'favorite' },
    { time: '17:00', title: 'Fiesta & Buffet', icon: 'restaurant' }
  ];

  galleryImages = [
    'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=2069&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=2070&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1583939003579-730e3918a45a?q=80&w=1974&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1465495910483-34a1d374bb51?q=80&w=2070&auto=format&fit=crop'
  ];

  constructor() {
    this.rsvpForm = this.fb.group({
      attendance: ['yes', Validators.required],
      guests: [1, [Validators.required, Validators.min(1)]],
      children: [0, [Validators.min(0)]],
      allergies: [''],
      music: [''],
      message: ['']
    });

    this.randomStory.set(this.storyPhrases[Math.floor(Math.random() * this.storyPhrases.length)]);

    afterNextRender(() => {
      const items = document.querySelectorAll('.animate-on-load');
      if (items.length > 0) {
        animate(
          items,
          { opacity: [0, 1], y: [20, 0] },
          { delay: stagger(0.2), duration: 0.8, ease: "easeOut" }
        );
      }
    });
  }

  ngOnInit() {
    this.updateCountdown();
    if (isPlatformBrowser(this.platformId)) {
      const interval = setInterval(() => this.updateCountdown(), 1000);
      this.destroyRef.onDestroy(() => clearInterval(interval));

      this.route.queryParamMap.subscribe(params => {
        const id = params.get('u');
        if (id) {
          const guest = guestsData.find(g => g.id === id);
          if (guest) {
            this.guestName.set(guest.name);
            this.guestPasses.set(guest.passes);
            this.inviteId.set(id);
            
            // Update validators with the guest's specific limit
            this.rsvpForm.get('guests')?.setValidators([
              Validators.required, 
              Validators.min(1), 
              Validators.max(guest.passes)
            ]);
            this.rsvpForm.get('guests')?.updateValueAndValidity();

            this.rsvpForm.patchValue({ 
              guests: guest.passes
            });
          }
        }
      });
    }
  }

  updateCountdown() {
    const now = new Date().getTime();
    const distance = this.weddingDate.getTime() - now;

    if (distance < 0) {
      this.timeLeft.set({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      return;
    }

    this.timeLeft.set({
      days: Math.floor(distance / (1000 * 60 * 60 * 24)),
      hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((distance % (1000 * 60)) / 1000)
    });
  }

  async submitRSVP() {
    if (this.rsvpForm.valid) {
      try {
        const rsvpData = {
          ...this.rsvpForm.value,
          inviteId: this.inviteId() || 'invitado-general',
          guestName: this.guestName() || 'Invitado General',
          timestamp: serverTimestamp()
        };

        await addDoc(collection(db, 'rsvps'), rsvpData);
        console.log('RSVP guardado en Firebase:', rsvpData);
        this.rsvpSubmitted.set(true);
      } catch (error) {
        console.error('Error al guardar en Firebase:', error);
        // Opcional: Mostrar mensaje de error al usuario
      }
    }
  }

  openEnvelope() {
    this.envelopeClosing.set(true);
    setTimeout(() => {
      this.isOpened.set(true);
    }, 800);
  }

  scrollTo(id: string) {
    if (isPlatformBrowser(this.platformId)) {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  openCalendarModal() {
    this.showCalendarModal.set(true);
  }

  closeCalendarModal() {
    this.showCalendarModal.set(false);
  }

  getCalendarLink(type: 'google' | 'outlook' | 'yahoo' | 'ical') {
    const title = 'Boda Alvaro & Heydi';
    const location = 'Casa de Campo - Chongo';
    const details = 'Ceremonia Civil y Recepción';
    const start = '20260425T150000';
    const end = '20260426T020000';

    switch (type) {
      case 'google':
        return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;
      case 'outlook':
        return `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${encodeURIComponent(title)}&startdt=2026-04-25T15:00:00&enddt=2026-04-26T02:00:00&body=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;
      case 'yahoo':
        return `https://calendar.yahoo.com/?v=60&view=d&type=20&title=${encodeURIComponent(title)}&st=${start}&et=${end}&desc=${encodeURIComponent(details)}&in_loc=${encodeURIComponent(location)}`;
      case 'ical': {
        const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${start}
DTEND:${end}
SUMMARY:${title}
DESCRIPTION:${details}
LOCATION:${location}
END:VEVENT
END:VCALENDAR`;
        return `data:text/calendar;charset=utf8,${encodeURIComponent(icsContent)}`;
      }
      default:
        return '#';
    }
  }
}
