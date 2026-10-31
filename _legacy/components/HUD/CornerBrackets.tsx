export function CornerBrackets() {
  const stroke = "rgba(159, 216, 232, 0.6)";
  return (
    <svg
      className="pointer-events-none fixed inset-0 z-10 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {/* top-left */}
      <polyline
        points="2,8 2,2 8,2"
        fill="none"
        stroke={stroke}
        strokeWidth="0.2"
        vectorEffect="non-scaling-stroke"
      />
      {/* top-right */}
      <polyline
        points="92,2 98,2 98,8"
        fill="none"
        stroke={stroke}
        strokeWidth="0.2"
        vectorEffect="non-scaling-stroke"
      />
      {/* bottom-left */}
      <polyline
        points="2,92 2,98 8,98"
        fill="none"
        stroke={stroke}
        strokeWidth="0.2"
        vectorEffect="non-scaling-stroke"
      />
      {/* bottom-right */}
      <polyline
        points="92,98 98,98 98,92"
        fill="none"
        stroke={stroke}
        strokeWidth="0.2"
        vectorEffect="non-scaling-stroke"
      />
      {/* centre vertical hairline */}
      <line
        x1="50"
        y1="12"
        x2="50"
        y2="20"
        stroke="rgba(159,216,232,0.25)"
        strokeWidth="0.1"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1="50"
        y1="80"
        x2="50"
        y2="88"
        stroke="rgba(159,216,232,0.25)"
        strokeWidth="0.1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
