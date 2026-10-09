import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export interface PillOption {
  value: string;
  label: string;
  /** Companies carrying this value, shown after the label when present. */
  count?: number;
}

/**
 * A row of selectable pills. Multi-select pills are checkboxes and
 * single-select pills are radios, each a real button with a focus ring.
 */
@Component( {
  selector: 'lv-pill-group',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lvm-pills" [attr.role]="mode() === 'single' ? 'radiogroup' : 'group'" [attr.aria-label]="ariaLabel()">
      @for ( pill of pills(); track pill.value ) {
        <button type="button" class="lvm-pill" [class.is-on]="pill.selected"
          [attr.role]="mode() === 'single' ? 'radio' : 'checkbox'" [attr.aria-checked]="pill.selected"
          (click)="toggle.emit( pill.value )">
          @if ( pill.selected ) {
            <svg class="lv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
          }
          {{ pill.label }}
          @if ( pill.countLabel ) { <small>{{ pill.countLabel }}</small> }
        </button>
      }
    </div>
  `,
} )
export class PillGroupComponent {
  readonly options = input.required<PillOption[]>();
  readonly selected = input<string[]>( [] );
  readonly mode = input<'multi' | 'single'>( 'multi' );
  readonly ariaLabel = input( '' );
  readonly toggle = output<string>();

  protected readonly pills = computed( () => {
    const selected = new Set( this.selected() );
    return this.options().map( ( option ) => ( {
      ...option,
      selected: selected.has( option.value ),
      countLabel: option.count === undefined ? '' : option.count.toLocaleString(),
    } ) );
  } );
}
