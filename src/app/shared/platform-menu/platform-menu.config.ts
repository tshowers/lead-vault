import { MenuAppConfig } from '@taliferro/ui/platform/universal-menu.model';

/** Lead Vault's part of the universal menu. */
export const PLATFORM_MENU_CONFIG: MenuAppConfig = {
  app: 'lead-vault',
  name: 'Lead Vault',
  items: [
    { label: 'Search leads', icon: 'search', route: '/', keywords: 'records companies' },
  ],
  secondaryItems: [
    { label: 'Help', icon: 'help', route: '/help' },
    { label: 'About', icon: 'info', route: '/about' },
  ],
};
