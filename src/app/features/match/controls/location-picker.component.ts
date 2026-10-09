import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GoogleMapsLoaderService } from '../../../services/google-maps-loader.service';
import { MatchLocation, MatchRadius, RADIUS_OPTIONS } from '../match.models';

/**
 * Location for the distance filter (replaces Match Maker's map pin). The
 * typed place is geocoded on Enter or blur; the radius pills set the filter
 * and "Anywhere" turns it off.
 */
@Component( {
  selector: 'lv-location-picker',
  standalone: true,
  imports: [ FormsModule ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lvm-location">
      <label class="lvm-location__field">
        <svg class="lv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
        <span class="lvm-sr">City, state or ZIP</span>
        <input type="text" [ngModel]="text()" (ngModelChange)="text.set( $event )" (keydown.enter)="$event.preventDefault(); geocode()"
          (blur)="geocode()" placeholder="City, state or ZIP" autocomplete="off" />
      </label>
      <div class="lvm-pills" role="radiogroup" aria-label="Distance">
        @for ( option of radiusPills(); track option.label ) {
          <button type="button" class="lvm-pill" role="radio" [class.is-on]="option.selected" [attr.aria-checked]="option.selected"
            [disabled]="option.disabled" (click)="radiusChange.emit( option.value )">
            @if ( option.selected ) { <svg class="lv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> }
            {{ option.label }}
          </button>
        }
      </div>
    </div>
    @if ( status() ) { <p class="lvm-hint" role="status">{{ status() }}</p> }
  `,
} )
export class LocationPickerComponent {
  readonly location = input<MatchLocation | null>( null );
  readonly radius = input<MatchRadius | null>( null );
  readonly locationChange = output<MatchLocation | null>();
  readonly radiusChange = output<MatchRadius | null>();

  protected readonly text = signal( '' );
  protected readonly status = signal( '' );
  private lastGeocoded = '';

  protected readonly radiusPills = computed( () => {
    const radius = this.radius();
    const hasLocation = !!this.location();
    return [
      ...RADIUS_OPTIONS.map( ( value ) => ( { value, label: `${ value } mi`, selected: hasLocation && radius === value, disabled: !hasLocation } ) ),
      { value: null, label: 'Anywhere', selected: !hasLocation || radius === null, disabled: false },
    ];
  } );

  constructor () {
    effect( () => {
      const label = this.location()?.label || '';
      this.text.set( label );
      this.lastGeocoded = label;
    } );
  }

  protected async geocode (): Promise<void> {
    const query = this.text().trim();
    if ( query === this.lastGeocoded ) return;
    this.lastGeocoded = query;

    if ( !query ) {
      this.status.set( '' );
      this.locationChange.emit( null );
      return;
    }

    this.status.set( 'Finding that place…' );
    try {
      await GoogleMapsLoaderService.load();
      const { results } = await new google.maps.Geocoder().geocode( { address: query, region: 'us' } );
      const place = results[ 0 ];
      if ( !place ) {
        this.status.set( 'We couldn’t find that place. Try a city and state, or a ZIP.' );
        return;
      }
      const label = this.shortLabel( place ) || query;
      this.status.set( '' );
      this.lastGeocoded = label;
      this.locationChange.emit( { label, lat: place.geometry.location.lat(), lng: place.geometry.location.lng() } );
      // Typing a place means you want a distance filter; default to 50 mi.
      if ( this.radius() === null ) this.radiusChange.emit( 50 );
    } catch {
      this.status.set( 'Location search is unavailable right now.' );
    }
  }

  /** "Austin, TX" rather than "Austin, TX, USA". */
  private shortLabel ( place: google.maps.GeocoderResult ): string {
    const part = ( type: string, short = false ) => {
      const component = place.address_components.find( ( item ) => item.types.includes( type ) );
      return component ? ( short ? component.short_name : component.long_name ) : '';
    };
    const city = part( 'locality' ) || part( 'postal_town' ) || part( 'administrative_area_level_2' );
    const state = part( 'administrative_area_level_1', true );
    const zip = part( 'postal_code' );
    if ( city && state ) return `${ city }, ${ state }`;
    if ( zip && state ) return `${ zip }, ${ state }`;
    return place.formatted_address.replace( /, USA$/, '' );
  }
}
