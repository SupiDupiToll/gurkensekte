import { Scales } from "@phosphor-icons/react/dist/ssr";

export function Footer() {
  return (
    <footer className="border-t border-gurken-500/20 bg-gurken-950/60 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-2">
          <span aria-hidden="true">🥒</span>
          <p className="text-gurken-400 text-sm font-bold">
            Rui Xie &copy; {new Date().getFullYear()} &mdash; Alle Rechte
            eingelegt.
          </p>
          <span aria-hidden="true">🥒</span>
        </div>
        <p className="text-gurken-600 text-xs max-w-md">
          Diese Website ist eine satirische Parodie. Keine echten Gurken wurden
          verletzt.
        </p>
        <a
          data-impressum-popup
          className="inline-flex items-center gap-1.5 text-gurken-500 hover:text-gurken-300 text-xs underline underline-offset-2 cursor-pointer transition-colors"
        >
          <Scales size={14} />
          Impressum
        </a>
      </div>
    </footer>
  );
}
