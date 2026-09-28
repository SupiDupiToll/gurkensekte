export function Footer() {
  return (
    <footer className="mt-auto border-t border-white/[0.07]">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-10 text-center md:flex-row md:justify-between md:text-left">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-xl" aria-hidden="true">
            🥒
          </span>
          <div>
            <p className="font-display text-[15px] font-semibold text-[#ede8d6]">
              Gurken Sekte
            </p>
            <p className="text-xs text-[#6b7565]">
              Rui Xie © {new Date().getFullYear()} — Alle Rechte eingelegt.
            </p>
          </div>
        </div>

        <p className="max-w-sm text-xs leading-relaxed text-[#6b7565]">
          Satirische Parodie, keine echte Glaubensgemeinschaft.
          Keine Gurke wurde verletzt.
        </p>

        <a
          data-impressum-popup
          className="cursor-pointer rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-[#a3ad9a] transition-colors hover:border-[#abc189]/40 hover:text-[#ede8d6]"
        >
          Impressum
        </a>
      </div>
    </footer>
  );
}
