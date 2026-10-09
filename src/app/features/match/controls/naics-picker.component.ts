import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatchApiService } from '../match-api.service';

const MAX_SUGGESTIONS = 8;

/**
 * NAICS capabilities: selected codes as violet pills with a remove button, a
 * type-ahead over the 2022 NAICS list (by code or title, with how many
 * companies carry each), and one-click suggestions from the company step.
 */
@Component( {
  selector: 'lv-naics-picker',
  standalone: true,
  imports: [ FormsModule ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if ( selectedPills().length ) {
      <div class="lvm-pills">
        @for ( pill of selectedPills(); track pill.code ) {
          <span class="lvm-naics">
            <b>{{ pill.code }}</b> {{ pill.title }}
            <button type="button" (click)="remove.emit( pill.code )" [attr.aria-label]="'Remove ' + pill.code">
              <svg class="lv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </span>
        }
      </div>
    }

    <div class="lvm-typeahead">
      <label class="lvm-typeahead__field">
        <svg class="lv-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <span class="lvm-sr">Add a NAICS code or keyword</span>
        <input type="text" [ngModel]="query()" (ngModelChange)="query.set( $event )" (keydown.enter)="$event.preventDefault(); addFirst()"
          placeholder="Add a code or keyword" autocomplete="off" role="combobox" aria-autocomplete="list"
          [attr.aria-expanded]="matches().length > 0" aria-controls="lvm-naics-list" />
      </label>
      @if ( matches().length ) {
        <ul class="lvm-typeahead__list" id="lvm-naics-list" role="listbox">
          @for ( option of matches(); track option.code ) {
            <li role="option" aria-selected="false">
              <button type="button" (click)="pick( option.code )">
                <b>{{ option.code }}</b>
                <span>{{ option.title }}</span>
                <small>{{ option.countLabel }}</small>
              </button>
            </li>
          }
        </ul>
      }
    </div>

    @if ( suggestionPills().length ) {
      <div class="lvm-suggest">
        <span>{{ suggestionLabel() }}</span>
        @for ( pill of suggestionPills(); track pill.code ) {
          <button type="button" class="lvm-pill lvm-pill--outline" (click)="add.emit( pill.code )">
            + <b>{{ pill.code }}</b> {{ pill.title }}
          </button>
        }
      </div>
    }
  `,
} )
export class NaicsPickerComponent {
  private readonly options = toSignal( inject( MatchApiService ).naicsOptions(), { initialValue: [] } );

  readonly selected = input<string[]>( [] );
  /** NAICS code -> companies carrying it (from the vocabulary). */
  readonly counts = input<Record<string, number>>( {} );
  readonly suggestions = input<string[]>( [] );
  readonly suggestionLabel = input( 'Suggested:' );
  readonly add = output<string>();
  readonly remove = output<string>();

  protected readonly query = signal( '' );

  private readonly titles = computed( () => new Map( this.options().map( ( option ) => [ option.code, option.title ] ) ) );

  protected readonly selectedPills = computed( () => this.selected().map( ( code ) => ( {
    code,
    title: this.titles().get( code ) || '',
  } ) ) );

  protected readonly suggestionPills = computed( () => {
    const selected = new Set( this.selected() );
    return this.suggestions().filter( ( code ) => !selected.has( code ) ).map( ( code ) => ( {
      code,
      title: this.titles().get( code ) || '',
    } ) );
  } );

  /** Codes first by prefix match, then by title words; most-carried codes win ties. */
  protected readonly matches = computed( () => {
    const query = this.query().trim().toLowerCase();
    if ( query.length < 2 ) return [];
    const selected = new Set( this.selected() );
    const counts = this.counts();
    const isCode = /^\d+$/.test( query );
    // Every typed word must appear: "commercial building" finds "Commercial and Institutional Building Construction".
    const words = query.split( /\s+/ ).filter( Boolean );

    return this.options()
      .filter( ( option ) => {
        if ( selected.has( option.code ) ) return false;
        if ( isCode ) return option.code.startsWith( query );
        const title = option.title.toLowerCase();
        return words.every( ( word ) => title.includes( word ) );
      } )
      .map( ( option ) => ( { ...option, count: counts[ option.code ] || 0 } ) )
      .sort( ( a, b ) => b.count - a.count || a.code.localeCompare( b.code ) )
      .slice( 0, MAX_SUGGESTIONS )
      .map( ( option ) => ( {
        ...option,
        countLabel: option.count ? `${ option.count.toLocaleString() } companies` : 'No companies yet',
      } ) );
  } );

  protected pick ( code: string ): void {
    this.add.emit( code );
    this.query.set( '' );
  }

  protected addFirst (): void {
    const first = this.matches()[ 0 ];
    if ( first ) this.pick( first.code );
  }
}
