import { Component, Input, OnInit, AfterViewInit, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { GoogleMapsModule, GoogleMap } from '@angular/google-maps';
import { CommonModule } from '@angular/common';
import { LoggerService } from '../../services/logger.service';
import { GoogleMapsLoaderService } from '../../services/google-maps-loader.service';

/** Ported near-verbatim from shared/page/contact-map/contact-map.component.ts - self-contained, only needs LoggerService + GoogleMapsLoaderService, both copied over. */
@Component( {
  selector: 'app-contact-map',
  standalone: true,
  imports: [CommonModule, GoogleMapsModule],
  templateUrl: './contact-map.component.html',
  styleUrl: './contact-map.component.css'
} )
export class ContactMapComponent implements AfterViewInit, OnInit, OnChanges {

  @Input() latitude!: number;
  @Input() longitude!: number;

  @ViewChild( GoogleMap, { static: false } ) map!: GoogleMap;

  scriptLoaded = false;

  center: google.maps.LatLngLiteral = { lat: 37.7749, lng: -122.4194 }; // Default center
  zoom = 8;
  options: google.maps.MapOptions = {
    zoom: this.zoom,
    mapTypeId: 'roadmap'
  };

  marker!: google.maps.marker.AdvancedMarkerElement;

  constructor ( private logger: LoggerService ) { }

  ngOnInit (): void {
    this.updateCenter();
  }

  ngOnChanges ( changes: SimpleChanges ): void {
    if ( changes['latitude'] || changes['longitude'] ) {
      this.updateCenter();
      if ( this.map ) {
        this.map.center = this.center;
        this.updateMarkerPosition();
      }
    }
  }

  async ngAfterViewInit () {
    try {
      await GoogleMapsLoaderService.load();
      this.scriptLoaded = true;
      this.initializeMarker();  // Initialize marker after script is loaded
      this.updateMarkerPosition();  // Ensure marker is positioned after script is loaded
    } catch ( error ) {
      this.logger.error( 'Failed to load Google Maps script:', error );
    }
  }

  updateCenter (): void {
    if ( this.latitude && this.longitude ) {
      this.center = {
        lat: this.latitude,
        lng: this.longitude,
      };
      if ( this.map ) {
        this.map.center = this.center; // Update the map center dynamically
      }
    }
  }

  initializeMarker (): void {
    if ( this.map && !this.marker ) {
      this.marker = new google.maps.marker.AdvancedMarkerElement( {
        position: this.center,
        map: this.map.googleMap,
        title: 'Marker Title', // Add any title if necessary
      } );
    }
  }

  updateMarkerPosition (): void {
    if ( this.marker ) {
      this.marker.position = this.center;  // Update the marker's position
    }
  }

}
