import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

/** Copied verbatim from the monorepo's services/google-maps-loader.service.ts - generic script-loader, no module coupling. */
@Injectable({
  providedIn: 'root'
})
export class GoogleMapsLoaderService {
  private static googleMapsPromise: Promise<void>;
  private static placesLibraryPromise: Promise<google.maps.PlacesLibrary>;
  private static readonly SCRIPT_ID = 'googleMapsScript';
  private static readonly LIBRARIES = 'places,marker';

  static load(): Promise<void> {
    if ( typeof google !== 'undefined' && google.maps ) {
      this.googleMapsPromise = Promise.resolve();
      return this.googleMapsPromise;
    }

    if ( this.googleMapsPromise ) {
      return this.googleMapsPromise;
    }

    this.googleMapsPromise = new Promise( ( resolve, reject ) => {
      const finishIfReady = () => {
        if ( typeof google !== 'undefined' && google.maps ) {
          resolve();
          return true;
        }
        return false;
      };

      if ( finishIfReady() ) {
        return;
      }

      ( window as any ).initMap = () => {
        finishIfReady();
      };

      const existingScript = document.getElementById( this.SCRIPT_ID ) as HTMLScriptElement | null;
      if ( existingScript ) {
        existingScript.addEventListener( 'load', () => finishIfReady(), { once: true } );
        existingScript.addEventListener( 'error', () => reject( new Error( 'Google Maps API failed to load.' ) ), { once: true } );
        return;
      }

      const script = document.createElement( 'script' );
      script.id = this.SCRIPT_ID;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googleMapsApiKey}&libraries=${this.LIBRARIES}&loading=async&callback=initMap`;
      script.async = true;
      script.defer = true;
      script.onerror = () => reject( new Error( 'Google Maps API failed to load.' ) );
      document.head.appendChild( script );
    } );

    return this.googleMapsPromise;
  }

  static async loadPlacesLibrary(): Promise<google.maps.PlacesLibrary> {
    await this.load();

    if ( this.placesLibraryPromise ) {
      return this.placesLibraryPromise;
    }

    this.placesLibraryPromise = google.maps.importLibrary(
      'places'
    ) as Promise<google.maps.PlacesLibrary>;

    return this.placesLibraryPromise;
  }
}
