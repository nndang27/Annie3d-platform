import { LOCALES, type Locale, PSEUDO } from '@annie3d/i18n';
import { Check, Languages } from 'lucide-react';
import { useRef, useState } from 'react';
import { setLocale, useT } from '../i18n';
import { Popover } from './Popover';

/**
 * The language picker: each language under its own name, so a person finds theirs without
 * reading the current one. The list is shared by the top bar button and the file menu (phones).
 */
export function LanguageMenu({
  anchor,
  align = 'end',
  trigger,
  onClose,
}: {
  anchor: DOMRect;
  align?: 'start' | 'end';
  trigger: HTMLElement | null;
  onClose: () => void;
}) {
  const t = useT();
  const pick = (code: Locale) => {
    onClose();
    void setLocale(code);
  };
  return (
    <Popover
      anchor={anchor}
      align={align}
      trigger={trigger}
      onClose={onClose}
      label={t('common.language')}
      testId="language-menu"
    >
      <div role="menu" className="lang-menu">
        {LOCALES.map((l) => (
          <button
            type="button"
            role="menuitemradio"
            aria-checked={t.locale === l.code}
            key={l.code}
            // Screen readers pronounce each name in its own language. The pseudo-locale page is
            // tagged "en" for number formatting, so English is marked apart from it there.
            lang={t.locale === PSEUDO && l.code === 'en' ? 'en-US' : l.tag}
            onClick={() => pick(l.code)}
            data-testid={`language-${l.code}`}
          >
            {l.name}
            {t.locale === l.code && <Check size={15} aria-hidden="true" className="lang-check" />}
          </button>
        ))}
      </div>
    </Popover>
  );
}

/** Top bar entry: the current language's own name (an icon only on phones). */
export function LanguageButton() {
  const t = useT();
  const [menu, setMenu] = useState<DOMRect | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = LOCALES.find((l) => l.code === t.locale);
  const name = current?.name ?? t('common.language');
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="lang-button"
        aria-label={t('lang.button', { language: name })}
        aria-haspopup="menu"
        aria-expanded={!!menu}
        onClick={(e) => setMenu(menu ? null : e.currentTarget.getBoundingClientRect())}
        data-testid="language-button"
      >
        <Languages size={16} aria-hidden="true" />
        <span className="lbl" lang={current?.tag}>
          {name}
        </span>
      </button>
      {menu && <LanguageMenu anchor={menu} trigger={trigger.current} onClose={() => setMenu(null)} />}
    </>
  );
}
