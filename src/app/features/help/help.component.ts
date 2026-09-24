import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { SeoService } from '../../shared/seo.service';

interface HelpStep {
  number: string;
  title: string;
  copy: string;
  details: string[];
}

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './help.component.html',
  styleUrl: './help.component.css',
})
export class HelpComponent implements OnInit {
  constructor(
    private readonly title: Title,
    private readonly meta: Meta,
    private readonly seo: SeoService,
  ) {}

  ngOnInit(): void {
    const pageTitle = 'Help — Lead Vault';
    const description = 'How to use Lead Vault: search for a lead, read the free masked preview, unlock the full record when it\'s worth it, and validate an email address on its own.';
    this.title.setTitle(pageTitle);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: pageTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: 'https://lead-vault.taliferro.tech/help' });
    this.meta.updateTag({ name: 'twitter:title', content: pageTitle });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.seo.setCanonical('https://lead-vault.taliferro.tech/help');
  }

  readonly steps: HelpStep[] = [
    {
      number: '01',
      title: 'Search for a lead',
      copy: 'Search by company, industry, capability, or buying signal — plain language works.',
      details: [
        'Results come back as masked teasers: company name, contact name, and a partially hidden email.',
        'No sign-in required just to search and preview.',
      ],
    },
    {
      number: '02',
      title: 'Or validate an email on its own',
      copy: 'Switch to email validation to check whether a specific address is deliverable, with a confidence score — independent of unlocking a lead.',
      details: [
        'Useful when you already have an email and just need to confirm it\'s real before you use it.',
      ],
    },
    {
      number: '03',
      title: 'Unlock the full record',
      copy: 'When a teaser looks worth pursuing, unlock it to reveal the complete contact and everything Lead Vault has enriched about the company.',
      details: [
        'Unlock a single lead for $29.',
        'Add a $1 recommended-approach brief once a lead is unlocked.',
        'Prefer volume? Sign up for Suite for unlimited Lead Vault access instead of paying per lead.',
      ],
    },
    {
      number: '04',
      title: 'Take it further',
      copy: 'Once unlocked, a lead doesn\'t have to stay in Lead Vault.',
      details: [
        'Signed-in users can add an unlocked lead directly to Network to start tracking the relationship.',
        'Download or copy the record\'s contact details for use elsewhere.',
      ],
    },
  ];
}
