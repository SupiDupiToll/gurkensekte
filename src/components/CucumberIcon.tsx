import type { SVGAttributes } from "react";

type CucumberVariant = "cucumber" | "pickle" | "seed";

interface CucumberIconProps extends SVGAttributes<SVGSVGElement> {
  size?: number | string;
  variant?: CucumberVariant;
}

export function CucumberIcon({
  size = 32,
  variant = "cucumber",
  ...props
}: CucumberIconProps) {
  const s = typeof size === "number" ? size : 32;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      {variant === "cucumber" && (
        <>
          <ellipse cx={16} cy={17} rx={10} ry={13} fill="#22c55e" />
          <ellipse cx={16} cy={17} rx={7} ry={10} fill="#4ade80" />
          <ellipse cx={16} cy={17} rx={4} ry={6} fill="#86efac" opacity={0.5} />
          {[0, 1, 2, 3, 4].map((i) => (
            <ellipse
              key={i}
              cx={14 + (i % 2) * 4}
              cy={9 + i * 3.5}
              rx={1.2}
              ry={1.8}
              fill="#22c55e"
              opacity={0.6}
            />
          ))}
          <path
            d="M14 4 Q16 1 18 4"
            stroke="#16a34a"
            strokeWidth={1.5}
            strokeLinecap="round"
            fill="none"
          />
          <ellipse cx={13} cy={21} rx={0.8} ry={0.5} fill="#15803d" opacity={0.4} />
          <ellipse cx={19} cy={14} rx={0.8} ry={0.5} fill="#15803d" opacity={0.4} />
        </>
      )}
      {variant === "pickle" && (
        <>
          <ellipse cx={16} cy={17} rx={8} ry={12} fill="#166534" />
          <ellipse cx={16} cy={17} rx={5} ry={9} fill="#15803d" />
          <path
            d="M14 5 Q16 2 18 5"
            stroke="#14532d"
            strokeWidth={1.5}
            strokeLinecap="round"
            fill="none"
          />
          {[0, 1, 2].map((i) => (
            <ellipse
              key={i}
              cx={15 + (i % 2) * 2}
              cy={10 + i * 4.5}
              rx={1}
              ry={1.5}
              fill="#14532d"
              opacity={0.5}
            />
          ))}
        </>
      )}
      {variant === "seed" && (
        <>
          <ellipse cx={16} cy={17} rx={6} ry={9} fill="#86efac" />
          <ellipse cx={16} cy={17} rx={3.5} ry={5.5} fill="#bbf7d0" />
          <path
            d="M15 9 Q16 7 17 9"
            stroke="#4ade80"
            strokeWidth={1.2}
            strokeLinecap="round"
            fill="none"
          />
          <ellipse cx={16} cy={17} rx={1.2} ry={1.8} fill="#4ade80" opacity={0.6} />
        </>
      )}
    </svg>
  );
}
