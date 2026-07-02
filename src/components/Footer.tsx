import { FloatingCucumber, WigglingCucumber } from "./SpinningCucumber";

export function Footer() {
  return (
    <footer className="border-t border-gurken-500/30 bg-gurken-900/60 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-2">
          <WigglingCucumber size="text-xl" />
          <p className="text-gurken-400 text-sm font-bold">
            Gurken Sekte &copy; {new Date().getFullYear()} &mdash; Alle Rechte
            eingelegt.
          </p>
          <FloatingCucumber size="text-xl" />
        </div>
        <p className="text-gurken-600 text-xs">
          Diese Website ist eine satirische Parodie. Keine echten Gurken wurden
          verletzt.
        </p>
        <a
          data-impressum-popup
          className="text-gurken-500 hover:text-gurken-300 text-xs underline underline-offset-2 cursor-pointer transition-colors"
        >
          Impressum
        </a>
      </div>
    </footer>
  );
}
